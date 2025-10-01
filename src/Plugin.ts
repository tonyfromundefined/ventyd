import type z from "zod";
import type { BaseSchema } from "./defineSchema";
import type { $$IEntity } from "./Entity";

/**
 * Plugin interface for extending repository functionality with cross-cutting concerns.
 *
 * @typeParam Entity - The entity type this plugin operates on
 *
 * @remarks
 * Plugins provide a powerful extension mechanism for implementing cross-cutting
 * concerns without polluting domain logic. They are executed sequentially after
 * successful event persistence, making them ideal for side effects and
 * integrations.
 *
 * ## Common Use Cases
 *
 * - **Audit Logging**: Track all entity changes for compliance
 * - **Notifications**: Send emails, webhooks, or push notifications
 * - **Analytics**: Stream events to data warehouses or analytics platforms
 * - **Cache Invalidation**: Clear caches when entities change
 * - **Search Indexing**: Update search indices with entity changes
 * - **Event Projection**: Build read models and materialized views
 * - **Integration**: Sync with external systems and APIs
 *
 * ## Execution Guarantees
 *
 * - Plugins execute **after** successful event persistence
 * - Plugins execute **sequentially** in the order they were registered
 * - Plugin failures do **not** rollback the committed events
 * - Each plugin receives the same entity state and event list
 *
 * @example
 * ```typescript
 * const auditLogPlugin: Plugin<User> = {
 *   async onCommited({ entity, events }) {
 *     await auditLog.record({
 *       entityType: "user",
 *       entityId: entity.entityId,
 *       actor: getCurrentUser(),
 *       changes: events.map(e => ({
 *         event: e.eventName,
 *         timestamp: e.eventCreatedAt,
 *         data: e.body,
 *       })),
 *     });
 *   },
 * }
 * ```
 *
 * @since 1.0.0
 */
export type Plugin<Entity extends $$IEntity<BaseSchema>> = {
  /**
   * Callback executed after events are successfully committed to storage.
   *
   * @param args - Plugin execution context
   * @param args.entity - The entity instance with updated state
   * @param args.events - Array of events that were just committed
   * @returns A promise that resolves when the plugin completes
   *
   * @remarks
   * This method is called with the entity's current state (after applying
   * the committed events) and the list of events that were just persisted.
   * The plugin can perform any side effects but should not modify the entity
   * or events as they have already been persisted.
   *
   * ## Implementation Guidelines
   *
   * ### Error Handling
   * Plugins should handle their own errors gracefully. Throwing an error
   * will not rollback the committed events but may affect subsequent plugins.
   *
   * ```typescript
   * async onCommited({ entity, events }) {
   *   try {
   *     await this.sendNotification(entity, events);
   *   } catch (error) {
   *     // Log error but don't throw
   *     console.error('Notification failed:', error);
   *     // Optionally, queue for retry
   *     await this.queueForRetry(entity, events, error);
   *   }
   * }
   * ```
   *
   * ### Performance Considerations
   * For time-consuming operations, consider async processing:
   *
   * ```typescript
   * async onCommited({ entity, events }) {
   *   // Quick synchronous validations
   *   if (!this.shouldProcess(entity, events)) return;
   *
   *   // Queue for async processing
   *   await messageQueue.send({
   *     type: 'process-entity-events',
   *     entityId: entity.entityId,
   *     eventIds: events.map(e => e.eventId)
   *   });
   * }
   * ```
   *
   * ### Filtering Events
   * Process only relevant events:
   *
   * ```typescript
   * async onCommited({ entity, events }) {
   *   const relevantEvents = events.filter(e =>
   *     ['user:verified', 'user:upgraded'].includes(e.eventName)
   *   );
   *
   *   if (relevantEvents.length > 0) {
   *     await this.processEvents(entity, relevantEvents);
   *   }
   * }
   * ```
   *
   * @example
   * ```typescript
   * // Notification Plugin
   * class NotificationPlugin implements Plugin<Order> {
   *   async onCommited({ entity, events }) {
   *     for (const event of events) {
   *       switch (event.eventName) {
   *         case 'order:confirmed':
   *           await emailService.send({
   *             to: entity.customerEmail,
   *             subject: 'Order Confirmed',
   *             template: 'order-confirmation',
   *             data: { orderId: entity.entityId, ...event.body }
   *           });
   *           break;
   *
   *         case 'order:shipped':
   *           await smsService.send({
   *             to: entity.customerPhone,
   *             message: `Your order ${entity.entityId} has been shipped!`
   *           });
   *           break;
   *       }
   *     }
   *   }
   * }
   *
   * // Analytics Plugin
   * class AnalyticsPlugin implements Plugin<User> {
   *   async onCommited({ entity, events }) {
   *     const metrics = events.map(event => ({
   *       metric: `user.${event.eventName}`,
   *       value: 1,
   *       tags: {
   *         userId: entity.entityId,
   *         userPlan: entity.plan,
   *         timestamp: event.eventCreatedAt
   *       }
   *     }));
   *
   *     await analytics.trackBatch(metrics);
   *   }
   * }
   *
   * // Search Index Plugin
   * class SearchIndexPlugin implements Plugin<Product> {
   *   async onCommited({ entity, events }) {
   *     const hasRelevantChanges = events.some(e =>
   *       ['product:created', 'product:updated', 'product:deleted'].includes(e.eventName)
   *     );
   *
   *     if (hasRelevantChanges) {
   *       if (entity.isDeleted) {
   *         await searchIndex.delete(entity.entityId);
   *       } else {
   *         await searchIndex.upsert({
   *           id: entity.entityId,
   *           name: entity.name,
   *           description: entity.description,
   *           price: entity.price,
   *           category: entity.category,
   *           tags: entity.tags
   *         });
   *       }
   *     }
   *   }
   * }
   * ```
   *
   * @throws Plugin implementations should handle their own errors
   */
  onCommited: (args: {
    entity: Entity;
    events: z.infer<Entity[" $$schema"]["event"]>[];
  }) => Promise<void>;
};
