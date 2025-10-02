import Database from "better-sqlite3";
import { type Db, MongoClient } from "mongodb";
import { MongoMemoryServer } from "mongodb-memory-server";
import type { Storage } from "../../src/defineStorage";
import { createInMemoryStorage, type InMemoryStorage } from "./InMemoryStorage";
import { createMongoDBStorage, type MongoDBStorage } from "./MongoDBStorage";
import { createSQLiteStorage, type SQLiteStorage } from "./SQLiteStorage";

/**
 * Storage factory for creating different storage implementations.
 */
export type StorageType = "memory" | "mongodb" | "sqlite";

export interface StorageFactory {
  type: StorageType;
  create(): Promise<Storage>;
  cleanup?(): Promise<void>;
}

/**
 * Create an in-memory storage factory.
 */
export function createInMemoryStorageFactory(): StorageFactory {
  let storage: InMemoryStorage | null = null;

  return {
    type: "memory",
    async create() {
      storage = createInMemoryStorage();
      return storage;
    },
    async cleanup() {
      storage?.clear();
    },
  };
}

/**
 * Create a MongoDB storage factory with in-memory MongoDB server.
 */
export function createMongoDBStorageFactory(): StorageFactory {
  let mongod: MongoMemoryServer | null = null;
  let client: MongoClient | null = null;
  let db: Db | null = null;
  let storage: MongoDBStorage | null = null;

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

      // Create storage
      storage = createMongoDBStorage(db);
      return storage;
    },
    async cleanup() {
      try {
        // Clean up MongoDB resources
        if (storage) {
          await storage.clear();
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
 * Create a SQLite storage factory with in-memory database.
 */
export function createSQLiteStorageFactory(): StorageFactory {
  let db: Database.Database | null = null;
  let storage: SQLiteStorage | null = null;

  return {
    type: "sqlite",
    async create() {
      // Create in-memory SQLite database
      db = new Database(":memory:");

      // Create storage
      storage = createSQLiteStorage(db);
      return storage;
    },
    async cleanup() {
      // Clean up SQLite resources
      if (storage) {
        await storage.close();
      }
    },
  };
}

/**
 * Get all available storage factories.
 */
export function getAllStorageFactories(): StorageFactory[] {
  return [
    createInMemoryStorageFactory(),
    createMongoDBStorageFactory(),
    createSQLiteStorageFactory(),
  ];
}

/**
 * Helper to create storage by type.
 */
export async function createStorage(type: StorageType): Promise<{
  storage: Storage;
  cleanup: () => Promise<void>;
}> {
  let factory: StorageFactory;

  switch (type) {
    case "memory":
      factory = createInMemoryStorageFactory();
      break;
    case "mongodb":
      factory = createMongoDBStorageFactory();
      break;
    case "sqlite":
      factory = createSQLiteStorageFactory();
      break;
    default:
      throw new Error(`Unknown storage type: ${type}`);
  }

  const storage = await factory.create();

  return {
    storage,
    cleanup: async () => {
      if (factory.cleanup) {
        await factory.cleanup();
      }
    },
  };
}
