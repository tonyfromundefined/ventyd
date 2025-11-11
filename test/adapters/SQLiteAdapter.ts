/** biome-ignore-all lint/suspicious/noExplicitAny: for testing */

import type Database from "better-sqlite3";
import type { Adapter } from "../../src";

type BaseEvent = {
  eventId: string;
  eventName: `${string}:${string}`;
  eventCreatedAt: string;
  entityName: string;
  entityId: string;
  body: any;
};

/**
 * SQLite adapter implementation for event sourcing.
 * This adapter uses SQLite to persist events.
 */
export const createSQLiteAdapter = (db: Database.Database): SQLiteAdapter => {
  // Create events table
  db.exec(`
    CREATE TABLE IF NOT EXISTS events (
      event_id TEXT PRIMARY KEY,
      entity_name TEXT NOT NULL,
      entity_id TEXT NOT NULL,
      event_name TEXT NOT NULL,
      event_created_at TEXT NOT NULL,
      body TEXT NOT NULL
    )
  `);

  // Create indexes for better query performance
  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_entity
    ON events (entity_name, entity_id);

    CREATE INDEX IF NOT EXISTS idx_created_at
    ON events (event_created_at);
  `);

  // Prepare statements
  const insertStmt = db.prepare(`
    INSERT INTO events (
      event_id, entity_name, entity_id,
      event_name, event_created_at, body
    ) VALUES (?, ?, ?, ?, ?, ?)
  `);

  const selectStmt = db.prepare(`
    SELECT * FROM events
    WHERE entity_name = ? AND entity_id = ?
    ORDER BY event_created_at ASC
  `);

  const adapter: Adapter = {
    /**
     * Retrieves all events for a specific entity.
     */
    async getEventsByEntityId(args: {
      entityName: string;
      entityId: string;
    }): Promise<BaseEvent[]> {
      const rows = selectStmt.all(args.entityName, args.entityId) as any[];

      return rows.map((row) => ({
        eventId: row.event_id,
        entityName: row.entity_name,
        entityId: row.entity_id,
        eventName: row.event_name,
        eventCreatedAt: row.event_created_at,
        body: JSON.parse(row.body),
      }));
    },

    /**
     * Commits new events to the adapter.
     */
    async commitEvents(args: {
      entityName: string;
      entityId: string;
      events: BaseEvent[];
      state: any;
    }): Promise<void> {
      if (args.events.length === 0) return;

      const insertMany = db.transaction((events: any[]) => {
        for (const event of events) {
          insertStmt.run(
            event.eventId,
            event.entityName,
            event.entityId,
            event.eventName,
            event.eventCreatedAt,
            JSON.stringify(event.body),
          );
        }
      });

      insertMany(args.events);

      // Note: In this implementation, we don't persist state separately
      // since it can be reconstructed from events
    },
  };

  return {
    ...adapter,
    /**
     * Utility method to clear all events (useful for test cleanup).
     */
    async clear(): Promise<void> {
      db.exec("DELETE FROM events");
    },

    /**
     * Utility method to get all stored events (useful for debugging tests).
     */
    async getAllEvents(): Promise<BaseEvent[]> {
      const rows = db
        .prepare("SELECT * FROM events ORDER BY event_created_at ASC")
        .all() as any[];

      return rows.map((row) => ({
        eventId: row.event_id,
        entityName: row.entity_name,
        entityId: row.entity_id,
        eventName: row.event_name,
        eventCreatedAt: row.event_created_at,
        body: JSON.parse(row.body),
      }));
    },

    /**
     * Utility method to get the count of events for a specific entity.
     */
    async getEventCount(entityName: string, entityId: string): Promise<number> {
      const result = db
        .prepare(
          "SELECT COUNT(*) as count FROM events WHERE entity_name = ? AND entity_id = ?",
        )
        .get(entityName, entityId) as any;

      return result.count;
    },

    /**
     * Close the database connection (useful for cleanup).
     */
    async close(): Promise<void> {
      db.close();
    },
  };
};

export type SQLiteAdapter = Adapter & {
  clear(): Promise<void>;
  getAllEvents(): Promise<BaseEvent[]>;
  getEventCount(entityName: string, entityId: string): Promise<number>;
  close(): Promise<void>;
};
