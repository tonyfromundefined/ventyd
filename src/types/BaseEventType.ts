/**
 * Base structure for all events in Ventyd.
 *
 * @remarks
 * This type defines the minimum structure that all events must have,
 * regardless of which validation library is used.
 *
 * @property eventId - Unique identifier for this event
 * @property eventCreatedAt - ISO timestamp when the event was created
 * @property eventName - Fully-qualified event name (e.g., "user:created")
 * @property entityId - The entity instance this event belongs to
 * @property entityName - The entity type (e.g., "user", "order")
 * @property body - Custom event payload (schema-specific)
 *
 * @internal
 */
export type BaseEventType = {
  eventId: string;
  eventCreatedAt: string;
  eventName: string;
  entityId: string;
  entityName: string;
  body: unknown;
};
