import type {
  InferEntityNameFromSchema,
  InferEventFromSchema,
  InferStateFromSchema,
  Schema,
} from "./Schema";

/**
 * Plugin interface for extending repository behavior with side effects.
 *
 * @remarks
 * Plugins provide a composable way to add cross-cutting concerns to your
 * event sourcing system without modifying core domain logic. They execute
 * **after** events are successfully committed to storage.
 *
 * ## Design Philosophy
 *
 * Plugins follow the **Observer Pattern**, receiving notifications when
 * domain events are persisted. This enables:
 *
 * - **Separation of Concerns**: Keep domain logic pure, side effects in plugins
 * - **Composability**: Combine multiple plugins without conflicts
 * - **Testability**: Test business logic independently from side effects
 *
 * ## Common Use Cases
 *
 * - **Event Broadcasting**: Publish events to message queues or webhooks
 * - **Analytics**: Track business metrics and user behavior
 * - **Denormalization**: Update read models and projections
 * - **Notifications**: Send emails, push notifications, or SMS
 * - **Audit Logging**: Record operations for compliance
 * - **Search Indexing**: Update Elasticsearch or other search engines
 *
 * ## Execution Model
 *
 * Plugins execute with the following guarantees:
 *
 * - **After Commit**: Only run after events are safely persisted
 * - **Parallel Execution**: All plugins run concurrently via Promise.allSettled
 * - **Isolated Failures**: One plugin failure doesn't affect others
 * - **Non-Blocking**: Events are committed regardless of plugin outcomes
 *
 * ## Error Handling
 *
 * Plugin errors are caught and handled gracefully:
 *
 * - Errors don't roll back committed events (events are already persisted)
 * - Failed plugins don't prevent other plugins from running
 * - Use `onPluginError` callback in repository config to handle errors
 * - By default, errors are silently ignored to protect main business flow
 *
 * ## Best Practices
 *
 * ### 1. Keep Plugins Idempotent
 *
 * Plugins may be retried or executed multiple times in distributed systems:
 *
 * ```typescript
 * const analyticsPlugin: Plugin = {
 *   async onCommitted({ entityName, entityId, events }) {
 *     // Use event IDs to prevent duplicate tracking
 *     for (const event of events) {
 *       await analytics.trackOnce(event.eventId, {
 *         name: event.eventName,
 *         properties: event.body
 *       });
 *     }
 *   }
 * };
 * ```
 *
 * ### 2. Handle Errors Gracefully
 *
 * Don't throw errors that would disrupt the main flow:
 *
 * ```typescript
 * const notificationPlugin: Plugin = {
 *   async onCommitted({ events }) {
 *     try {
 *       await sendNotifications(events);
 *     } catch (error) {
 *       // Log but don't throw - notifications are non-critical
 *       logger.error('Failed to send notifications', error);
 *     }
 *   }
 * };
 * ```
 *
 * ### 3. Avoid Heavy Computation
 *
 * Keep plugins lightweight since they block commit() completion:
 *
 * ```typescript
 * // Good - Enqueue for background processing
 * const heavyPlugin: Plugin = {
 *   async onCommitted({ events }) {
 *     await queue.enqueue('process-events', events);
 *   }
 * };
 *
 * // Avoid - Heavy processing blocks commit
 * const badPlugin: Plugin = {
 *   async onCommitted({ events }) {
 *     await processLargeDataset(events); // Too slow!
 *   }
 * };
 * ```
 *
 * ### 4. Respect Entity Boundaries
 *
 * Plugins receive events for a single entity - don't load other entities:
 *
 * ```typescript
 * // Good - Work with provided data
 * const auditPlugin: Plugin = {
 *   async onCommitted({ entityName, entityId, events }) {
 *     await audit.log({
 *       entity: `${entityName}:${entityId}`,
 *       eventCount: events.length
 *     });
 *   }
 * };
 *
 * // Avoid - Loading other entities adds complexity
 * const badPlugin: Plugin = {
 *   async onCommitted({ entityId }) {
 *     const user = await userRepo.findOne({ entityId }); // Don't do this
 *   }
 * };
 * ```
 *
 * @example
 * ### Event Broadcasting Plugin
 *
 * ```typescript
 * import type { Plugin } from 'ventyd';
 *
 * const eventBusPlugin: Plugin = {
 *   async onCommitted({ entityName, entityId, events }) {
 *     // Publish events to message queue
 *     for (const event of events) {
 *       await eventBus.publish(event.eventName, {
 *         entityName,
 *         entityId,
 *         body: event.body,
 *         timestamp: event.eventCreatedAt
 *       });
 *     }
 *   }
 * };
 * ```
 *
 * @example
 * ### Analytics Plugin
 *
 * ```typescript
 * import type { Plugin } from 'ventyd';
 *
 * const analyticsPlugin: Plugin = {
 *   async onCommitted({ entityName, events }) {
 *     const metrics = events.map(event => ({
 *       name: event.eventName,
 *       timestamp: event.eventCreatedAt,
 *       properties: event.body
 *     }));
 *
 *     await analytics.track(metrics);
 *   }
 * };
 * ```
 *
 * @example
 * ### Audit Logging Plugin
 *
 * ```typescript
 * import type { Plugin } from 'ventyd';
 *
 * const auditPlugin: Plugin = {
 *   async onCommitted({ entityName, entityId, events, state }) {
 *     await auditLog.record({
 *       entity: `${entityName}:${entityId}`,
 *       eventCount: events.length,
 *       eventNames: events.map(e => e.eventName),
 *       finalState: state,
 *       timestamp: new Date().toISOString()
 *     });
 *   }
 * };
 * ```
 *
 * @example
 * ### Search Index Plugin
 *
 * ```typescript
 * import type { Plugin } from 'ventyd';
 *
 * const searchIndexPlugin: Plugin = {
 *   async onCommitted({ entityName, entityId, state }) {
 *     // Update search index with current state
 *     await searchEngine.index({
 *       id: `${entityName}:${entityId}`,
 *       type: entityName,
 *       document: state
 *     });
 *   }
 * };
 * ```
 *
 * @example
 * ### Webhook Notification Plugin
 *
 * ```typescript
 * import type { Plugin } from 'ventyd';
 *
 * const webhookPlugin: Plugin = {
 *   async onCommitted({ entityName, events }) {
 *     // Filter for important events
 *     const importantEvents = events.filter(e =>
 *       e.eventName.includes('created') ||
 *       e.eventName.includes('deleted')
 *     );
 *
 *     if (importantEvents.length > 0) {
 *       await fetch('https://api.example.com/webhooks', {
 *         method: 'POST',
 *         headers: { 'Content-Type': 'application/json' },
 *         body: JSON.stringify({ events: importantEvents })
 *       });
 *     }
 *   }
 * };
 * ```
 *
 * @example
 * ### Using Plugins with Repository
 *
 * ```typescript
 * import { createRepository } from 'ventyd';
 *
 * const userRepository = createRepository(User, {
 *   adapter,
 *   plugins: [
 *     eventBusPlugin,
 *     analyticsPlugin,
 *     auditPlugin
 *   ],
 *   // Optional: Handle plugin errors
 *   onPluginError: (error, plugin) => {
 *     logger.error('Plugin execution failed', {
 *       error: error.message,
 *       stack: error.stack
 *     });
 *     // Send to error tracking service
 *     sentry.captureException(error);
 *   }
 * });
 * ```
 *
 * @since 2.0.0
 */
export type Plugin<
  $$Schema = Schema<string, { eventName: string }, {}, string, ":">,
> = {
  /**
   * Hook called after events are successfully committed to storage.
   *
   * @param args - Event commit information
   * @param args.entityName - The type of entity (e.g., "user", "order")
   * @param args.entityId - The unique identifier of the entity
   * @param args.events - Array of events that were committed
   * @param args.state - The entity's state after applying all events
   * @returns A promise that resolves when the plugin completes
   *
   * @remarks
   * This hook runs **after** events are persisted, so:
   * - Events cannot be modified or cancelled
   * - Throwing errors won't roll back the commit
   * - The hook runs in parallel with other plugins
   * - Errors are caught and passed to `onPluginError` if configured
   *
   * ## Performance Considerations
   *
   * Since this hook blocks `commit()` completion:
   * - Keep operations fast (< 100ms recommended)
   * - For heavy work, enqueue to background jobs
   * - Use connection pooling for external services
   * - Implement timeouts for external API calls
   *
   * @example
   * ```typescript
   * const plugin: Plugin = {
   *   async onCommitted({ entityName, entityId, events, state }) {
   *     console.log(`Committed ${events.length} events to ${entityName}:${entityId}`);
   *     console.log('Final state:', state);
   *   }
   * };
   * ```
   */
  onCommitted?: (args: {
    entityName: InferEntityNameFromSchema<$$Schema>;
    entityId: string;
    events: InferEventFromSchema<$$Schema>[];
    state: InferStateFromSchema<$$Schema>;
  }) => void | Promise<void>;
};
