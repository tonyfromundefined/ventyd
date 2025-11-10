/** biome-ignore-all lint/style/noNonNullAssertion: for testing */
/** biome-ignore-all lint/suspicious/noExplicitAny: for testing */

import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import type { Adapter } from "../src/Adapter";
import { createRepository } from "../src/createRepository";
import type { Plugin } from "../src/Plugin";
import { getAllAdapterFactories } from "./adapters";
import { User } from "./entities/User";

/**
 * Plugin test suite that validates plugin execution and error handling
 * across different adapter backends.
 *
 * Tests include:
 * - Plugin execution after successful commits
 * - Parallel plugin execution
 * - Plugin error handling
 * - Plugin isolation (one failure doesn't affect others)
 */
getAllAdapterFactories().forEach((factory) => {
  describe(`Plugin Tests with ${factory.type.toUpperCase()} Adapter`, () => {
    let adapter: Adapter;

    beforeEach(async () => {
      adapter = await factory.create();
    });

    afterEach(async () => {
      if (factory.cleanup) {
        await factory.cleanup();
      }
    });

    /**
     * Section 1: Basic Plugin Execution
     * Tests fundamental plugin invocation and data passing
     */
    describe("1. Basic Plugin Execution", () => {
      test("should execute plugin after successful commit", async () => {
        const pluginCallbackSpy = vi.fn();

        const testPlugin: Plugin = {
          onCommitted: pluginCallbackSpy,
        };

        const repository = createRepository(User, {
          adapter,
          plugins: [testPlugin],
        });

        const user = User.create({
          body: {
            nickname: "PluginTest",
            email: "plugin@test.com",
          },
        });

        await repository.commit(user);

        expect(pluginCallbackSpy).toHaveBeenCalledTimes(1);
        expect(pluginCallbackSpy).toHaveBeenCalledWith({
          entityName: "user",
          entityId: user.entityId,
          events: expect.arrayContaining([
            expect.objectContaining({
              eventName: "user:created",
              entityId: user.entityId,
            }),
          ]),
          state: expect.objectContaining({
            nickname: "PluginTest",
            email: "plugin@test.com",
          }),
        });
      });

      test("should pass all committed events to plugin", async () => {
        let capturedEvents: any[] = [];

        const testPlugin: Plugin = {
          onCommitted: ({ events }) => {
            capturedEvents = events;
          },
        };

        const repository = createRepository(User, {
          adapter,
          plugins: [testPlugin],
        });

        const user = User.create({
          body: {
            nickname: "MultiEvent",
            email: "multi@event.com",
          },
        });

        user.updateProfile({ bio: "First update" });
        user.updateProfile({ nickname: "UpdatedName" });

        await repository.commit(user);

        expect(capturedEvents.length).toBe(3); // created + 2 updates
        expect(capturedEvents.map((e) => e.eventName)).toEqual([
          "user:created",
          "user:profile_updated",
          "user:profile_updated",
        ]);
      });

      test("should pass final state to plugin", async () => {
        let capturedState: any = null;

        const testPlugin: Plugin = {
          onCommitted: ({ state }) => {
            capturedState = state;
          },
        };

        const repository = createRepository(User, {
          adapter,
          plugins: [testPlugin],
        });

        const user = User.create({
          body: {
            nickname: "StateTest",
            email: "state@test.com",
          },
        });

        user.updateProfile({ bio: "Test bio" });

        await repository.commit(user);

        expect(capturedState).toEqual({
          nickname: "StateTest",
          email: "state@test.com",
          bio: "Test bio",
          deletedAt: null,
        });
      });

      test("should not execute plugin on empty commit", async () => {
        const pluginCallbackSpy = vi.fn();

        const testPlugin: Plugin = {
          onCommitted: pluginCallbackSpy,
        };

        const repository = createRepository(User, {
          adapter,
          plugins: [testPlugin],
        });

        const user = User.create({
          body: {
            nickname: "EmptyCommit",
            email: "empty@commit.com",
          },
        });

        await repository.commit(user);

        expect(pluginCallbackSpy).toHaveBeenCalledTimes(1);

        // Second commit without new events
        await repository.commit(user);

        // Plugin should not be called again (no new events)
        expect(pluginCallbackSpy).toHaveBeenCalledTimes(1);
      });
    });

    /**
     * Section 2: Multiple Plugins
     * Tests execution order and isolation between plugins
     */
    describe("2. Multiple Plugins", () => {
      test("should execute all plugins in parallel", async () => {
        const executionOrder: number[] = [];
        const delayTimes = [50, 10, 30];

        const plugins: Plugin[] = delayTimes.map((delay, index) => ({
          async onCommitted() {
            await new Promise((resolve) => setTimeout(resolve, delay));
            executionOrder.push(index);
          },
        }));

        const repository = createRepository(User, {
          adapter,
          plugins,
        });

        const user = User.create({
          body: {
            nickname: "ParallelTest",
            email: "parallel@test.com",
          },
        });

        const startTime = Date.now();
        await repository.commit(user);
        const duration = Date.now() - startTime;

        // All plugins should be called
        expect(executionOrder).toHaveLength(3);

        // Execution should be parallel (faster plugin completes first)
        expect(executionOrder[0]).toBe(1); // 10ms delay
        expect(executionOrder[1]).toBe(2); // 30ms delay
        expect(executionOrder[2]).toBe(0); // 50ms delay

        // Total time should be closer to max delay (50ms) than sum (90ms)
        expect(duration).toBeLessThan(100); // Allow generous overhead for CI
      });

      test("should execute all plugins even if one fails", async () => {
        const successfulPlugin1Spy = vi.fn();
        const successfulPlugin2Spy = vi.fn();

        const plugins: Plugin[] = [
          { onCommitted: successfulPlugin1Spy },
          {
            onCommitted: () => {
              throw new Error("Plugin failure");
            },
          },
          { onCommitted: successfulPlugin2Spy },
        ];

        const repository = createRepository(User, {
          adapter,
          plugins,
        });

        const user = User.create({
          body: {
            nickname: "FailureTest",
            email: "failure@test.com",
          },
        });

        await repository.commit(user);

        // Both successful plugins should be called
        expect(successfulPlugin1Spy).toHaveBeenCalledTimes(1);
        expect(successfulPlugin2Spy).toHaveBeenCalledTimes(1);
      });

      test("should pass same data to all plugins", async () => {
        const capturedData: any[] = [];

        const plugins: Plugin[] = Array.from({ length: 3 }, () => ({
          onCommitted: (args) => {
            capturedData.push(args);
          },
        }));

        const repository = createRepository(User, {
          adapter,
          plugins,
        });

        const user = User.create({
          body: {
            nickname: "SharedData",
            email: "shared@data.com",
          },
        });

        await repository.commit(user);

        expect(capturedData).toHaveLength(3);

        // All plugins should receive same entityId
        expect(capturedData[0]!.entityId).toBe(user.entityId);
        expect(capturedData[1]!.entityId).toBe(user.entityId);
        expect(capturedData[2]!.entityId).toBe(user.entityId);

        // All plugins should receive same state
        expect(capturedData[0]!.state).toEqual(capturedData[1]!.state);
        expect(capturedData[1]!.state).toEqual(capturedData[2]!.state);
      });
    });

    /**
     * Section 3: Plugin Error Handling
     * Tests error handling and the onPluginError callback
     */
    describe("3. Plugin Error Handling", () => {
      test("should call onPluginError when plugin fails", async () => {
        const errorHandlerSpy = vi.fn();
        const testError = new Error("Plugin error");

        const failingPlugin: Plugin = {
          onCommitted: () => {
            throw testError;
          },
        };

        const repository = createRepository(User, {
          adapter,
          plugins: [failingPlugin],
          onPluginError: errorHandlerSpy,
        });

        const user = User.create({
          body: {
            nickname: "ErrorHandler",
            email: "error@handler.com",
          },
        });

        await repository.commit(user);

        expect(errorHandlerSpy).toHaveBeenCalledTimes(1);
        expect(errorHandlerSpy).toHaveBeenCalledWith(testError, failingPlugin);
      });

      test("should handle multiple plugin failures", async () => {
        const errorHandlerSpy = vi.fn();
        const error1 = new Error("Plugin 1 error");
        const error2 = new Error("Plugin 2 error");

        const plugin1: Plugin = {
          onCommitted: () => {
            throw error1;
          },
        };

        const plugin2: Plugin = {
          onCommitted: () => {
            throw error2;
          },
        };

        const plugin3: Plugin = {
          onCommitted: vi.fn(), // Successful plugin
        };

        const repository = createRepository(User, {
          adapter,
          plugins: [plugin1, plugin2, plugin3],
          onPluginError: errorHandlerSpy,
        });

        const user = User.create({
          body: {
            nickname: "MultiError",
            email: "multi@error.com",
          },
        });

        await repository.commit(user);

        expect(errorHandlerSpy).toHaveBeenCalledTimes(2);
        expect(errorHandlerSpy).toHaveBeenCalledWith(error1, plugin1);
        expect(errorHandlerSpy).toHaveBeenCalledWith(error2, plugin2);
      });

      test("should not call onPluginError when all plugins succeed", async () => {
        const errorHandlerSpy = vi.fn();

        const successfulPlugin: Plugin = {
          onCommitted: vi.fn(),
        };

        const repository = createRepository(User, {
          adapter,
          plugins: [successfulPlugin],
          onPluginError: errorHandlerSpy,
        });

        const user = User.create({
          body: {
            nickname: "NoError",
            email: "no@error.com",
          },
        });

        await repository.commit(user);

        expect(errorHandlerSpy).not.toHaveBeenCalled();
      });

      test("should not throw error when plugin fails without error handler", async () => {
        const failingPlugin: Plugin = {
          onCommitted: () => {
            throw new Error("Unhandled plugin error");
          },
        };

        const repository = createRepository(User, {
          adapter,
          plugins: [failingPlugin],
          // No onPluginError provided
        });

        const user = User.create({
          body: {
            nickname: "UnhandledError",
            email: "unhandled@error.com",
          },
        });

        // Should not throw - errors are silently ignored
        await expect(repository.commit(user)).resolves.not.toThrow();
      });

      test("should handle async plugin errors", async () => {
        const errorHandlerSpy = vi.fn();
        const testError = new Error("Async plugin error");

        const asyncFailingPlugin: Plugin = {
          async onCommitted() {
            await new Promise((resolve) => setTimeout(resolve, 10));
            throw testError;
          },
        };

        const repository = createRepository(User, {
          adapter,
          plugins: [asyncFailingPlugin],
          onPluginError: errorHandlerSpy,
        });

        const user = User.create({
          body: {
            nickname: "AsyncError",
            email: "async@error.com",
          },
        });

        await repository.commit(user);

        expect(errorHandlerSpy).toHaveBeenCalledTimes(1);
        expect(errorHandlerSpy).toHaveBeenCalledWith(
          testError,
          asyncFailingPlugin,
        );
      });
    });

    /**
     * Section 4: Plugin Lifecycle
     * Tests plugin behavior across multiple commits
     */
    describe("4. Plugin Lifecycle", () => {
      test("should execute plugin on every commit", async () => {
        const pluginCallbackSpy = vi.fn();

        const testPlugin: Plugin = {
          onCommitted: pluginCallbackSpy,
        };

        const repository = createRepository(User, {
          adapter,
          plugins: [testPlugin],
        });

        const userId = "lifecycle-user";

        // First commit
        const user1 = User.create({
          entityId: userId,
          body: {
            nickname: "Lifecycle",
            email: "lifecycle@test.com",
          },
        });
        await repository.commit(user1);

        // Second commit
        const user2 = await repository.findOne({ entityId: userId });
        user2?.updateProfile({ bio: "Updated" });
        await repository.commit(user2!);

        // Third commit
        const user3 = await repository.findOne({ entityId: userId });
        user3?.delete();
        await repository.commit(user3!);

        expect(pluginCallbackSpy).toHaveBeenCalledTimes(3);
      });

      test("should track event accumulation across commits", async () => {
        const eventCounts: number[] = [];

        const trackingPlugin: Plugin = {
          onCommitted: ({ events }) => {
            eventCounts.push(events.length);
          },
        };

        const repository = createRepository(User, {
          adapter,
          plugins: [trackingPlugin],
        });

        const userId = "accumulation-user";

        // First commit: 1 event
        const user1 = User.create({
          entityId: userId,
          body: {
            nickname: "Accumulation",
            email: "accumulation@test.com",
          },
        });
        await repository.commit(user1);

        // Second commit: 2 events
        const user2 = await repository.findOne({ entityId: userId });
        user2?.updateProfile({ bio: "Bio 1" });
        user2?.updateProfile({ bio: "Bio 2" });
        await repository.commit(user2!);

        // Third commit: 1 event
        const user3 = await repository.findOne({ entityId: userId });
        user3?.delete();
        await repository.commit(user3!);

        expect(eventCounts).toEqual([1, 2, 1]);
      });
    });

    /**
     * Section 5: Real-world Plugin Scenarios
     * Tests practical plugin use cases
     */
    describe("5. Real-world Plugin Scenarios", () => {
      test("should support analytics plugin", async () => {
        const analyticsEvents: any[] = [];

        const analyticsPlugin: Plugin = {
          async onCommitted({ events }) {
            for (const event of events) {
              analyticsEvents.push({
                name: event.eventName,
                timestamp: event.eventCreatedAt,
                properties: event.body,
              });
            }
          },
        };

        const repository = createRepository(User, {
          adapter,
          plugins: [analyticsPlugin],
        });

        const user = User.create({
          body: {
            nickname: "Analytics",
            email: "analytics@test.com",
          },
        });
        user.updateProfile({ bio: "Analytics user" });

        await repository.commit(user);

        expect(analyticsEvents).toHaveLength(2);
        expect(analyticsEvents[0]).toMatchObject({
          name: "user:created",
          properties: {
            nickname: "Analytics",
            email: "analytics@test.com",
          },
        });
        expect(analyticsEvents[1]).toMatchObject({
          name: "user:profile_updated",
          properties: {
            bio: "Analytics user",
          },
        });
      });

      test("should support audit logging plugin", async () => {
        const auditLogs: any[] = [];

        const auditPlugin: Plugin = {
          async onCommitted({ entityName, entityId, events, state }) {
            auditLogs.push({
              entity: `${entityName}:${entityId}`,
              eventCount: events.length,
              eventNames: events.map((e) => e.eventName),
              finalState: state,
              timestamp: new Date().toISOString(),
            });
          },
        };

        const repository = createRepository(User, {
          adapter,
          plugins: [auditPlugin],
        });

        const user = User.create({
          body: {
            nickname: "Audit",
            email: "audit@test.com",
          },
        });

        await repository.commit(user);

        expect(auditLogs).toHaveLength(1);
        expect(auditLogs[0]).toMatchObject({
          entity: `user:${user.entityId}`,
          eventCount: 1,
          eventNames: ["user:created"],
          finalState: {
            nickname: "Audit",
            email: "audit@test.com",
            bio: undefined,
            deletedAt: null,
          },
        });
      });

      test("should support event broadcasting plugin", async () => {
        const publishedEvents: any[] = [];

        const eventBusPlugin: Plugin = {
          async onCommitted({ entityName, entityId, events }) {
            for (const event of events) {
              publishedEvents.push({
                topic: event.eventName,
                payload: {
                  entityName,
                  entityId,
                  body: event.body,
                  timestamp: event.eventCreatedAt,
                },
              });
            }
          },
        };

        const repository = createRepository(User, {
          adapter,
          plugins: [eventBusPlugin],
        });

        const user = User.create({
          body: {
            nickname: "EventBus",
            email: "eventbus@test.com",
          },
        });

        await repository.commit(user);

        expect(publishedEvents).toHaveLength(1);
        expect(publishedEvents[0]).toMatchObject({
          topic: "user:created",
          payload: {
            entityName: "user",
            entityId: user.entityId,
            body: {
              nickname: "EventBus",
              email: "eventbus@test.com",
            },
          },
        });
      });

      test("should support conditional notification plugin", async () => {
        const notifications: string[] = [];

        const notificationPlugin: Plugin = {
          async onCommitted({ events }) {
            const importantEvents = events.filter(
              (e) =>
                e.eventName === "user:created" ||
                e.eventName === "user:deleted",
            );

            if (importantEvents.length > 0) {
              for (const event of importantEvents) {
                notifications.push(`Important event: ${event.eventName}`);
              }
            }
          },
        };

        const repository = createRepository(User, {
          adapter,
          plugins: [notificationPlugin],
        });

        const user = User.create({
          entityId: "notification-user",
          body: {
            nickname: "Notification",
            email: "notification@test.com",
          },
        });
        await repository.commit(user);

        const user2 = await repository.findOne({
          entityId: "notification-user",
        });
        user2?.updateProfile({ bio: "Update" }); // Should not trigger notification
        await repository.commit(user2!);

        const user3 = await repository.findOne({
          entityId: "notification-user",
        });
        user3?.delete(); // Should trigger notification
        await repository.commit(user3!);

        expect(notifications).toEqual([
          "Important event: user:created",
          "Important event: user:deleted",
        ]);
      });
    });
  });
});
