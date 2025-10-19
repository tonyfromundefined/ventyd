import Database from "better-sqlite3";
import { type Db, MongoClient } from "mongodb";
import { MongoMemoryServer } from "mongodb-memory-server";
import type { Adapter } from "../../src/Adapter";
import { createInMemoryAdapter, type InMemoryAdapter } from "./InMemoryAdapter";
import { createMongoDBAdapter, type MongoDBAdapter } from "./MongoDBAdapter";
import { createSQLiteAdapter, type SQLiteAdapter } from "./SQLiteAdapter";

/**
 * Adapter factory for creating different adapter implementations.
 */
export type AdapterType = "memory" | "mongodb" | "sqlite";

export interface AdapterFactory {
  type: AdapterType;
  create(): Promise<Adapter>;
  cleanup?(): Promise<void>;
}

/**
 * Create an in-memory adapter factory.
 */
export function createInMemoryAdapterFactory(): AdapterFactory {
  let adapter: InMemoryAdapter | null = null;

  return {
    type: "memory",
    async create() {
      adapter = createInMemoryAdapter();
      return adapter;
    },
    async cleanup() {
      adapter?.clear();
    },
  };
}

/**
 * Create a MongoDB adapter factory with in-memory MongoDB server.
 */
export function createMongoDBAdapterFactory(): AdapterFactory {
  let mongod: MongoMemoryServer | null = null;
  let client: MongoClient | null = null;
  let db: Db | null = null;
  let adapter: MongoDBAdapter | null = null;

  return {
    type: "mongodb",
    async create() {
      // Start in-memory MongoDB server
      mongod = await MongoMemoryServer.create();
      const uri = mongod.getUri();

      // Connect to MongoDB
      client = new MongoClient(uri);
      await client.connect();
      db = client.db("test");

      // Create adapter
      adapter = createMongoDBAdapter(db);
      return adapter;
    },
    async cleanup() {
      try {
        // Clean up MongoDB resources
        if (adapter) {
          await adapter.clear();
        }
      } catch {
        // Ignore errors during cleanup
      }

      try {
        if (client) {
          await client.close();
        }
      } catch {
        // Ignore client close errors
      }

      try {
        if (mongod) {
          await mongod.stop();
        }
      } catch {
        // Ignore mongod stop errors
      }
    },
  };
}

/**
 * Create a SQLite adapter factory with in-memory database.
 */
export function createSQLiteAdapterFactory(): AdapterFactory {
  let db: Database.Database | null = null;
  let adapter: SQLiteAdapter | null = null;

  return {
    type: "sqlite",
    async create() {
      // Create in-memory SQLite database
      db = new Database(":memory:");

      // Create adapter
      adapter = createSQLiteAdapter(db);
      return adapter;
    },
    async cleanup() {
      // Clean up SQLite resources
      if (adapter) {
        await adapter.close();
      }
    },
  };
}

/**
 * Get all available adapter factories.
 */
export function getAllAdapterFactories(): AdapterFactory[] {
  return [
    createInMemoryAdapterFactory(),
    createMongoDBAdapterFactory(),
    createSQLiteAdapterFactory(),
  ];
}

/**
 * Helper to create adapter by type.
 */
export async function createAdapter(type: AdapterType): Promise<{
  adapter: Adapter;
  cleanup: () => Promise<void>;
}> {
  let factory: AdapterFactory;

  switch (type) {
    case "memory":
      factory = createInMemoryAdapterFactory();
      break;
    case "mongodb":
      factory = createMongoDBAdapterFactory();
      break;
    case "sqlite":
      factory = createSQLiteAdapterFactory();
      break;
    default:
      throw new Error(`Unknown adapter type: ${type}`);
  }

  const adapter = await factory.create();

  return {
    adapter,
    cleanup: async () => {
      if (factory.cleanup) {
        await factory.cleanup();
      }
    },
  };
}
