# Ventyd

A TypeScript-first event sourcing library with full type safety and flexible storage backends.

## Features

- **Type-Safe Event Sourcing**: Full TypeScript support with comprehensive type inference
- **Standard Schema Support**: Built on [Standard Schema](https://standardschema.dev) specification for maximum flexibility
- **Multiple Validation Libraries**: Official support for Valibot, with easy integration for Zod, Typebox, ArkType, and more
- **Flexible Storage Adapters**: Connect to any database through a simple interface
- **Event-Driven Architecture**: Capture all state changes as immutable events
- **Time Travel**: Reconstruct entity state at any point in history
- **Lightweight**: Minimal dependencies, focused on core functionality
- **Plugin System**: Extensible architecture for side effects (analytics, logging, etc.)

## Installation

```bash
$ yarn add ventyd
```

### Installing Validation Libraries

Ventyd is built on the [Standard Schema](https://standardschema.dev) specification. You can use any Standard Schema-compliant validation library:

```bash
# Valibot (has built-in helper)
$ yarn add valibot

# TypeBox (has built-in helper)
# Note: `@sinclair/typemap` depends on `zod` for Standard Schema conversion
$ yarn add @sinclair/typebox @sinclair/typemap zod

# Or use any Standard Schema-compliant library directly
$ yarn add @standard-schema/spec
$ yarn add zod  # or arktype, etc.
```

## Quick Start

### 1. Define Your Schema

Define your entity schema with events and state. This example uses Valibot:

```typescript
import { defineSchema } from 'ventyd';
import { valibot, v } from 'ventyd/valibot';

const userSchema = defineSchema("user", {
  schema: valibot({
    event: {
      created: v.object({
        nickname: v.string(),
        email: v.pipe(v.string(), v.email()),
      }),
      profile_updated: v.object({
        nickname: v.optional(v.string()),
        bio: v.optional(v.string()),
      }),
      deleted: v.object({
        reason: v.optional(v.string()),
      }),
      restored: v.object({}),
    },
    state: v.object({
      nickname: v.string(),
      email: v.pipe(v.string(), v.email()),
      bio: v.optional(v.string()),
      deletedAt: v.optional(v.nullable(v.string())),
    }),
  }),
  initialEventName: "user:created", // Event that creates new entities
});
```

### 2. Create a Reducer

The reducer determines how events transform the entity state:

```typescript
import { defineReducer } from 'ventyd';

const userReducer = defineReducer(userSchema, (prevState, event) => {
  switch (event.eventName) {
    case "user:created":
      return {
        nickname: event.body.nickname,
        email: event.body.email,
        bio: undefined,
        deletedAt: null,
      };

    case "user:profile_updated":
      return {
        ...prevState,
        ...(event.body.nickname && { nickname: event.body.nickname }),
        ...(event.body.bio !== undefined && { bio: event.body.bio }),
      };

    case "user:deleted":
      return {
        ...prevState,
        deletedAt: event.eventCreatedAt,
      };

    case "user:restored":
      return {
        ...prevState,
        deletedAt: null,
      };

    default:
      return prevState;
  }
});
```

### 3. Create Your Entity Class

Create an entity class with business logic:

```typescript
import { Entity, mutation } from 'ventyd';

class User extends Entity(userSchema, userReducer) {
  get nickname() {
    return this.state.nickname;
  }

  get isDeleted() {
    return this.state.deletedAt !== null;
  }

  updateProfile = mutation(this, (dispatch, updates: { nickname?: string; bio?: string }) => {
    if (this.isDeleted) {
      throw new Error("Cannot update profile of deleted user");
    }
    dispatch("user:profile_updated", updates);
  });

  delete = mutation(this, (dispatch, reason?: string) => {
    if (this.isDeleted) {
      throw new Error("User is already deleted");
    }
    dispatch("user:deleted", { reason });
  });

  restore = mutation(this, (dispatch) => {
    if (!this.isDeleted) {
      throw new Error("User is not deleted");
    }
    dispatch("user:restored", {});
  });
}
```

### 4. Set Up Repository

Create a repository with an adapter:

```typescript
import { createRepository } from 'ventyd';
import type { Adapter } from 'ventyd';

// In-memory adapter for development
const createInMemoryAdapter = (): Adapter => {
  const eventStore: any[] = [];

  return {
    async getEventsByEntityId({ entityName, entityId }) {
      return eventStore.filter(e =>
        e.entityName === entityName &&
        e.entityId === entityId
      );
    },
    async commitEvents({ events }) {
      eventStore.push(...events);
    }
  };
};

const userRepository = createRepository(User, {
  adapter: createInMemoryAdapter()
});
```

### 5. Use Your Event-Sourced Entity

```typescript
// Create a new user
const user = User.create({
  body: {
    nickname: "JohnDoe",
    email: "john@example.com",
  }
});

// Update the user's profile
user.updateProfile({
  bio: "Software Engineer"
});

// Persist events to storage
await userRepository.commit(user);

// Retrieve and reconstruct the user from events
const retrievedUser = await userRepository.findOne({
  entityId: user.entityId
});

console.log(retrievedUser?.nickname); // "JohnDoe"
console.log(retrievedUser?.bio); // "Software Engineer"

// You can also load an entity from existing state (read-only)
const loadedUser = User.load({
  entityId: "user-123",
  state: {
    nickname: "ExistingUser",
    email: "existing@example.com",
    bio: "Loaded from database"
  }
});
```

## Core Concepts

### Event Sourcing

Event sourcing captures all changes to application state as a sequence of events. Instead of storing just the current state, the system stores all events that led to that state. This provides:

- **Complete Audit Trail**: Every change is recorded with who, what, when
- **Time Travel**: Reconstruct state at any point in time
- **Event Replay**: Rebuild state from scratch or migrate data structures
- **Debugging**: Understand exactly how the current state was reached

### Entities

Entities are domain objects with a unique identity that persist over time. In Ventyd:

- Entities maintain their state through events
- Each entity has a unique `entityId`
- State is computed by reducing all events in sequence
- Business logic is encapsulated in entity methods

### Events

Events represent facts that have happened in your system:

- Immutable once created
- Contain all information needed to update state
- Named with past tense (e.g., "created", "updated", "deleted")
- Automatically timestamped and versioned

### Reducers

Reducers are pure functions that compute state from events:

```typescript
(previousState, event) => newState
```

- Must be deterministic (same inputs always produce same output)
- Should not have side effects
- Handle all possible event types for the entity

### Mutations

Mutations are entity methods that dispatch events to change state. Use the `mutation()` helper:

```typescript
class User extends Entity(userSchema, userReducer) {
  updateProfile = mutation(this, (dispatch, updates: { nickname?: string; bio?: string }) => {
    if (this.isDeleted) {
      throw new Error("Cannot update deleted user");
    }
    dispatch("user:profile_updated", updates);
  });
}
```

The `mutation()` helper provides:
- Automatic dispatch binding to the entity
- Access to `this` for validation logic
- Type-safe mutation tracking
- Readonly entity enforcement

### Read-only Entities (CQRS)

Entities loaded from existing state are read-only and cannot dispatch new events:

```typescript
// Created/hydrated entities can mutate
const user = User.create({
  body: { nickname: "John", email: "john@example.com" }
});
user.updateProfile({ bio: "Software Engineer" }); // ✅ Works

// Loaded entities are read-only
const loadedUser = User.load({
  entityId: "user-123",
  state: { nickname: "John", email: "john@example.com" }
});
loadedUser.updateProfile({ bio: "..." }); // ❌ Type error & runtime error
```

This enforces **Command-Query Responsibility Segregation (CQRS)**:
- **Commands** (writes): Use entities created or hydrated from events
- **Queries** (reads): Use entities loaded from state snapshots

Benefits:
- Prevents mutations without event history
- Separates write and read models
- Maintains event sourcing integrity

## Validation Library Support

Ventyd is built on the [Standard Schema](https://standardschema.dev) specification, which provides a unified interface for all validation libraries.

### Supported Libraries

Any library that implements the Standard Schema specification works with Ventyd:

| Library | Status | Usage |
|---------|--------|-------|
| **[Valibot](https://valibot.dev)** | ✅ Official Helper | `ventyd/valibot` |
| **[TypeBox](https://github.com/sinclairzx81/typebox)** | ✅ Official Helper | `ventyd/typebox` |
| **[Zod](https://zod.dev)** | 🔜 Coming Soon | Use `standard()` for now |
| **[ArkType](https://arktype.io)** | 🔜 Coming Soon | Use `standard()` for now |

**Note:** Any Standard Schema-compliant library can be used with the `standard()` provider. Official helpers provide automatic event namespacing and better ergonomics.

### Using Valibot (Recommended)

Ventyd provides an official helper for Valibot that automatically handles event namespacing and metadata:

```typescript
import { defineSchema } from 'ventyd';
import { valibot, v } from 'ventyd/valibot';

const productSchema = defineSchema("product", {
  schema: valibot({
    event: {
      created: v.object({
        name: v.string(),
        price: v.pipe(v.number(), v.minValue(0))
      }),
      price_updated: v.object({
        price: v.pipe(v.number(), v.minValue(0))
      })
    },
    state: v.object({
      name: v.string(),
      price: v.number()
    })
  }),
  initialEventName: "product:created"
});
```

**Custom namespace separator:**

The default separator between entity name and event name is `":"` (e.g., `user:created`). You can customize it:

```typescript
const productSchema = defineSchema("product", {
  schema: valibot({
    event: {
      created: v.object({ name: v.string() }),
      updated: v.object({ price: v.number() })
    },
    state: v.object({ name: v.string(), price: v.number() }),
    namespaceSeparator: "/" // Events become "product/created", "product/updated"
  }),
  initialEventName: "product/created" // Must match the separator
});
```

### Using TypeBox

Ventyd provides an official helper for TypeBox that automatically handles event namespacing and metadata:

```typescript
import { defineSchema } from 'ventyd';
import { typebox, Type } from 'ventyd/typebox';

const productSchema = defineSchema("product", {
  schema: typebox({
    event: {
      created: Type.Object({
        name: Type.String(),
        price: Type.Number({ minimum: 0 })
      }),
      price_updated: Type.Object({
        price: Type.Number({ minimum: 0 })
      })
    },
    state: Type.Object({
      name: Type.String(),
      price: Type.Number()
    })
  }),
  initialEventName: "product:created"
});
```

**TypeBox features you can use:**

TypeBox provides powerful schema validation with JSON Schema support:

```typescript
const userSchema = defineSchema("user", {
  schema: typebox({
    event: {
      created: Type.Object({
        email: Type.String({ format: 'email', maxLength: 255 }),
        age: Type.Number({ minimum: 13, maximum: 120 }),
        role: Type.Union([
          Type.Literal('user'),
          Type.Literal('admin')
        ])
      }),
      profile_updated: Type.Object({
        bio: Type.Optional(Type.String({ maxLength: 500 })),
        avatar: Type.Optional(Type.String({ format: 'uri' }))
      })
    },
    state: Type.Object({
      email: Type.String(),
      age: Type.Number(),
      role: Type.String(),
      bio: Type.Optional(Type.String()),
      avatar: Type.Optional(Type.String())
    })
  }),
  initialEventName: "user:created"
});
```

**Custom namespace separator:**

Just like Valibot, you can customize the namespace separator:

```typescript
const productSchema = defineSchema("product", {
  schema: typebox({
    event: {
      created: Type.Object({ name: Type.String() }),
      updated: Type.Object({ price: Type.Number() })
    },
    state: Type.Object({ name: Type.String(), price: Type.Number() }),
    namespaceSeparator: "/" // Events become "product/created", "product/updated"
  }),
  initialEventName: "product/created" // Must match the separator
});
```

### Using Other Libraries (Standard Schema Provider)

For libraries without an official helper, use the `standard()` provider directly. This works with any Standard Schema-compliant library (Zod, ArkType, Typebox, etc.):

```typescript
import { defineSchema } from 'ventyd';
import { standard } from 'ventyd/standard';
import * as v from 'valibot'; // or zod, arktype, etc.

const userSchema = defineSchema("user", {
  schema: standard({
    event: {
      "user:created": v.object({
        eventId: v.string(),
        eventName: v.literal("user:created"),
        eventCreatedAt: v.string(),
        entityName: v.string(),
        entityId: v.string(),
        body: v.object({
          email: v.pipe(v.string(), v.email())
        })
      }),
      "user:updated": v.object({
        eventId: v.string(),
        eventName: v.literal("user:updated"),
        eventCreatedAt: v.string(),
        entityName: v.string(),
        entityId: v.string(),
        body: v.object({
          nickname: v.string()
        })
      })
    },
    state: v.object({
      email: v.string(),
      nickname: v.optional(v.string())
    })
  }),
  initialEventName: "user:created"
});
```

**Important:** When using `standard()` directly, you must manually include all event metadata fields (`eventId`, `eventName`, `eventCreatedAt`, `entityName`, `entityId`, `body`) in your event schemas. Official helpers like `valibot()` add these automatically.

Want an official helper for your favorite library? [Open an issue](https://github.com/tonyfromundefined/ventyd/issues) to let us know!

## Storage Adapters

Adapters connect Ventyd to your database. Implement the `Adapter` interface with two methods:

### Adapter Interface

```typescript
interface Adapter {
  getEventsByEntityId(params: {
    entityName: string;
    entityId: string;
  }): Promise<Event[]>;

  commitEvents(params: {
    events: Event[];
  }): Promise<void>;
}
```

### In-Memory Adapter (Development)

```typescript
import type { Adapter } from 'ventyd';

const createInMemoryAdapter = (): Adapter => {
  const events: any[] = [];

  return {
    async getEventsByEntityId({ entityName, entityId }) {
      return events.filter(e =>
        e.entityName === entityName && e.entityId === entityId
      );
    },
    async commitEvents({ events: newEvents }) {
      events.push(...newEvents);
    }
  };
};
```

### MongoDB Adapter (Production)

```typescript
import type { Adapter } from 'ventyd';
import { MongoClient } from 'mongodb';

const createMongoDBAdapter = (uri: string, dbName: string): Adapter => {
  const client = new MongoClient(uri);
  const db = client.db(dbName);
  const collection = db.collection('events');

  return {
    async getEventsByEntityId({ entityName, entityId }) {
      return collection
        .find({ entityName, entityId })
        .sort({ eventCreatedAt: 1 })
        .toArray();
    },
    async commitEvents({ events }) {
      if (events.length > 0) {
        await collection.insertMany(events);
      }
    }
  };
};
```

**Tip:** Add indexes on `(entityName, entityId)` and `eventCreatedAt` for optimal query performance.

## Plugins

Plugins extend repository behavior with side effects like analytics, logging, or notifications. They execute **after** events are committed, ensuring the main business flow stays fast and reliable.

### Basic Plugin

Create a plugin by implementing the `Plugin` interface:

```typescript
import type { Plugin } from 'ventyd';

const analyticsPlugin: Plugin = {
  async onCommitted({ entityName, entityId, events, state }) {
    // Track events in your analytics system
    for (const event of events) {
      await analytics.track({
        event: event.eventName,
        userId: entityId,
        properties: event.body,
        timestamp: event.eventCreatedAt
      });
    }
  }
};
```

### Using Plugins

Add plugins when creating a repository:

```typescript
const userRepository = createRepository(User, {
  adapter,
  plugins: [analyticsPlugin, auditPlugin, notificationPlugin]
});
```

### Plugin Execution Model

Plugins follow these guarantees:

- **After Commit**: Run only after events are safely persisted
- **Parallel Execution**: All plugins run concurrently (Promise.allSettled)
- **Isolated Failures**: One plugin failure doesn't affect others
- **Non-Blocking**: Events commit successfully regardless of plugin outcomes

### Error Handling

Handle plugin errors with the `onPluginError` callback:

```typescript
const userRepository = createRepository(User, {
  adapter,
  plugins: [analyticsPlugin, notificationPlugin],
  onPluginError: (error, plugin) => {
    // Log error
    logger.error('Plugin execution failed', {
      error: error instanceof Error ? error.message : String(error)
    });

    // Send to error tracking
    sentry.captureException(error, {
      tags: { component: 'plugin' }
    });
  }
});
```

### Common Plugin Patterns

#### Analytics Plugin

Track business metrics and user behavior:

```typescript
const analyticsPlugin: Plugin = {
  async onCommitted({ events }) {
    const metrics = events.map(event => ({
      name: event.eventName,
      timestamp: event.eventCreatedAt,
      properties: event.body
    }));

    await analytics.track(metrics);
  }
};
```

#### Audit Logging Plugin

Record all state changes for compliance:

```typescript
const auditPlugin: Plugin = {
  async onCommitted({ entityName, entityId, events, state }) {
    await auditLog.record({
      entity: `${entityName}:${entityId}`,
      eventCount: events.length,
      eventNames: events.map(e => e.eventName),
      finalState: state,
      timestamp: new Date().toISOString()
    });
  }
};
```

#### Event Broadcasting Plugin

Publish events to message queues or webhooks:

```typescript
const eventBusPlugin: Plugin = {
  async onCommitted({ entityName, entityId, events }) {
    for (const event of events) {
      await eventBus.publish(event.eventName, {
        entityName,
        entityId,
        body: event.body,
        timestamp: event.eventCreatedAt
      });
    }
  }
};
```

#### Search Indexing Plugin

Keep search indexes synchronized with entity state:

```typescript
const searchIndexPlugin: Plugin = {
  async onCommitted({ entityName, entityId, state }) {
    await searchEngine.index({
      id: `${entityName}:${entityId}`,
      type: entityName,
      document: state
    });
  }
};
```

#### Conditional Notification Plugin

Send notifications only for important events:

```typescript
const notificationPlugin: Plugin = {
  async onCommitted({ events, state }) {
    const importantEvents = events.filter(e =>
      e.eventName.includes('created') ||
      e.eventName.includes('deleted')
    );

    if (importantEvents.length > 0) {
      await notificationService.send({
        title: 'Important Event',
        message: `${importantEvents.length} important events occurred`,
        data: { events: importantEvents }
      });
    }
  }
};
```

### Plugin Best Practices

1. **Keep Plugins Fast**: Plugins block commit() completion. For heavy work, enqueue background jobs instead.

```typescript
// Good - Enqueue for background processing
const heavyPlugin: Plugin = {
  async onCommitted({ events }) {
    await jobQueue.enqueue('process-events', events);
  }
};

// Avoid - Heavy processing blocks commit
const slowPlugin: Plugin = {
  async onCommitted({ events }) {
    await processLargeDataset(events); // Too slow!
  }
};
```

2. **Make Plugins Idempotent**: Use event IDs to prevent duplicate processing.

```typescript
const idempotentPlugin: Plugin = {
  async onCommitted({ events }) {
    for (const event of events) {
      // Use event ID to ensure exactly-once processing
      await processOnce(event.eventId, () => {
        return analytics.track(event);
      });
    }
  }
};
```

3. **Handle Errors Gracefully**: Don't let plugin errors disrupt the main flow.

```typescript
const resilientPlugin: Plugin = {
  async onCommitted({ events }) {
    try {
      await externalService.notify(events);
    } catch (error) {
      // Log but don't throw - notifications are non-critical
      logger.error('Notification failed', error);
    }
  }
};
```

4. **Respect Entity Boundaries**: Work with provided data, don't load other entities.

```typescript
// Good - Use provided data
const goodPlugin: Plugin = {
  async onCommitted({ entityName, entityId, events }) {
    await logger.info(`${entityName}:${entityId} had ${events.length} events`);
  }
};

// Avoid - Don't load other entities
const badPlugin: Plugin = {
  async onCommitted({ entityId }) {
    const user = await userRepo.findOne({ entityId }); // Don't do this
  }
};
```

## Best Practices

### 1. Event Naming

- Use past tense to indicate something has happened
- Be specific and descriptive
- Include context in the event name

```typescript
// Good
"user:created"
"order:payment_received"
"subscription:cancelled"

// Avoid
"createUser"
"payment"
"cancel"
```

### 2. Event Granularity

- Keep events fine-grained and focused
- Each event should represent a single business fact
- Avoid "god events" that change multiple aspects

```typescript
// Good - Separate events for different concerns
dispatch("order:item_added", { productId, quantity, price });
dispatch("order:shipping_address_updated", { address });

// Avoid - Too many changes in one event
dispatch("order:updated", { items, address, status, ... });
```

### 3. Mutation Methods

Always use the `mutation()` helper and validate before dispatching:

```typescript
import { Entity, mutation } from 'ventyd';

class Order extends Entity(orderSchema, orderReducer) {
  ship = mutation(this, (dispatch, trackingNumber: string) => {
    // Validate business rules
    if (this.state.status !== "confirmed") {
      throw new Error("Order must be confirmed before shipping");
    }

    if (!trackingNumber) {
      throw new Error("Tracking number is required");
    }

    // Dispatch after validation
    dispatch("order:shipped", { trackingNumber });
  });
}
```

### 4. Error Handling

- Validate business rules before dispatching
- Use descriptive error messages
- Never modify state directly
- Let mutation helper enforce readonly constraints

## License

MIT

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## Support

For questions and support, please open an issue on GitHub.
