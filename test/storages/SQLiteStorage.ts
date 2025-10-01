/** biome-ignore-all lint/suspicious/noExplicitAny: for testing */

import type Database from "better-sqlite3";
import type z from "zod";
import type { BaseSchema } from "../../src/defineSchema";
import type { Storage } from "../../src/defineStorage";

/**
 * SQLite storage implementation for event sourcing.
 * This storage uses SQLite to persist events.
 */
export class SQLiteStorage implements Storage {
  private db: Database.Database;

  constructor(db: Database.Database) {
    this.db = db;

    // Create events table
    this.db.exec(`
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
    this.db.exec(`
      CREATE INDEX IF NOT EXISTS idx_entity 
      ON events (entity_name, entity_id);
      
      CREATE INDEX IF NOT EXISTS idx_created_at 
      ON events (event_created_at);
    `);

    // Prepare statements
    this.insertStmt = this.db.prepare(`
      INSERT INTO events (
        event_id, entity_name, entity_id, 
        event_name, event_created_at, body
      ) VALUES (?, ?, ?, ?, ?, ?)
    `);

    this.selectStmt = this.db.prepare(`
      SELECT * FROM events 
      WHERE entity_name = ? AND entity_id = ?
      ORDER BY event_created_at ASC
    `);
  }

  private insertStmt: Database.Statement;
  private selectStmt: Database.Statement;

  /**
   * Retrieves all events for a specific entity.
   */
  async getEventsByEntityId(args: {
    entityName: string;
    entityId: string;
  }): Promise<z.infer<BaseSchema["event"]>[]> {
    const rows = this.selectStmt.all(args.entityName, args.entityId) as any[];

    return rows.map((row) => ({
      eventId: row.event_id,
      entityName: row.entity_name,
      entityId: row.entity_id,
      eventName: row.event_name,
      eventCreatedAt: row.event_created_at,
      body: JSON.parse(row.body),
    }));
  }

  /**
   * Commits new events to the storage.
   */
  async commitEvents(args: {
    events: z.infer<BaseSchema["event"]>[];
  }): Promise<void> {
    if (args.events.length === 0) return;

    const insertMany = this.db.transaction((events: any[]) => {
      for (const event of events) {
        this.insertStmt.run(
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
  }

  /**
   * Utility method to clear all events (useful for test cleanup).
   */
  async clear(): Promise<void> {
    this.db.exec("DELETE FROM events");
  }

  /**
   * Utility method to get all stored events (useful for debugging tests).
   */
  async getAllEvents(): Promise<z.infer<BaseSchema["event"]>[]> {
    const rows = this.db
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
  }

  /**
   * Utility method to get the count of events for a specific entity.
   */
  async getEventCount(entityName: string, entityId: string): Promise<number> {
    const result = this.db
      .prepare(
        "SELECT COUNT(*) as count FROM events WHERE entity_name = ? AND entity_id = ?",
      )
      .get(entityName, entityId) as any;

    return result.count;
  }

  /**
   * Close the database connection (useful for cleanup).
   */
  async close(): Promise<void> {
    this.db.close();
  }
}
