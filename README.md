# Ventyd

A TypeScript-first event sourcing library with full type safety and flexible storage backends.

## Features

- **Type-Safe Event Sourcing**: Full TypeScript support with comprehensive type inference
- **Multiple Schema Libraries**: Built-in support for Valibot, with Zod, Typebox, and ArkType coming soon
- **Flexible Storage Adapters**: Connect to any database through a simple interface
- **Event-Driven Architecture**: Capture all state changes as immutable events
- **Time Travel**: Reconstruct entity state at any point in history
- **Lightweight**: Minimal dependencies, focused on core functionality
- **Plugin System**: Extensible architecture for side effects (analytics, logging, etc.)

## Installation

```bash
npm install ventyd
# or
yarn add ventyd
# or
pnpm add ventyd
```

### Installing Schema Libraries

Ventyd requires a schema validation library. Install the one you want to use:

```bash
# Valibot (recommended)
npm install valibot

# Coming soon: Zod, Typebox, ArkType
```

## Quick Start

### 1. Define Your Schema

Ventyd supports multiple schema validation libraries. Here we use Valibot (currently supported):

```typescript
import { defineSchema } from 'ventyd';
import { valibot, v } from 'ventyd/valibot';

const userSchema = defineSchema("user", {
  // Use the valibot provider to define events and state
  schema: valibot({
    // Define all possible events
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
    // Define the entity state structure
    state: v.object({
      nickname: v.string(),
      email: v.pipe(v.string(), v.email()),
      bio: v.optional(v.string()),
      deletedAt: v.optional(v.nullable(v.string())),
    }),
  }),
  // Specify which event initializes the entity (use fully-qualified name)
  initialEventName: "user:created",
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

Extend the Entity base class and add business logic using the `mutation()` helper:

```typescript
import { Entity, mutation } from 'ventyd';

class User extends Entity(userSchema, userReducer) {
  // Getters for convenient access
  get nickname() {
    return this.state.nickname;
  }

  get isDeleted() {
    return this.state.deletedAt !== null;
  }

  // Business methods with validation using mutation helper
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

### 4. Set Up Adapter and Repository

Create an adapter implementation and configure your repository:

```typescript
import { createRepository } from 'ventyd';
import type { Adapter, Plugin } from 'ventyd';

// Create in-memory adapter for development
const createInMemoryAdapter = (): Adapter => {
  const eventStore: any[] = [];

  return {
    async getEventsByEntityId({ entityName, entityId }) {
      // Implementation for retrieving events
      return eventStore.filter(e =>
        e.entityName === entityName &&
        e.entityId === entityId
      );
    },
    async commitEvents({ events }) {
      // Implementation for storing events
      eventStore.push(...events);
    }
  };
};

const adapter = createInMemoryAdapter();

// Optional: Create plugins for side effects
const analyticsPlugin: Plugin = {
  async onCommitted({ events }) {
    console.log(`Tracked ${events.length} events`);
  }
};

// Create a repository for your entity
const userRepository = createRepository(User, {
  adapter,
  plugins: [analyticsPlugin], // Optional
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

Mutations are entity methods that dispatch events to change state. Ventyd provides the `mutation()` helper to create mutation methods:

```typescript
class User extends Entity(userSchema, userReducer) {
  updateProfile = mutation(this, (dispatch, bio: string) => {
    if (this.isDeleted) {
      throw new Error("Cannot update deleted user");
    }
    dispatch("user:profile_updated", { bio });
  });
}
```

**Key features:**
- Automatically binds dispatch to the entity instance
- Maintains access to `this` for entity state and getters
- Marks methods as mutations for type-level tracking
- Enables readonly entity enforcement

### Read-only Entities (CQRS)

Entities loaded from existing state (via `Entity.load()`) are read-only and cannot dispatch new events:

```typescript
// Created entities are fully mutable
const user = User.create({
  body: { nickname: "John", email: "john@example.com" }
});
user.updateProfile("Software Engineer"); // ✅ Works

// Loaded entities are read-only
const loadedUser = User.load({
  entityId: "user-123",
  state: { nickname: "John", email: "john@example.com" }
});
loadedUser.updateProfile("..."); // ❌ Type error & runtime error
```

This enforces the **Command-Query Responsibility Segregation (CQRS)** pattern:
- **Commands** (write operations): Use entities created or hydrated from events
- **Queries** (read operations): Use entities loaded from current state snapshots

**Benefits:**
- Prevents accidental mutations without event history
- Separates write and read models
- Ensures event sourcing integrity

## Supported Schema Libraries

Ventyd provides official support for popular TypeScript validation libraries. Choose the one that best fits your project:

### ✅ Valibot (Currently Supported)

```typescript
import { defineSchema } from 'ventyd';
import { valibot, v } from 'ventyd/valibot';

const schema = defineSchema("product", {
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

### 🚧 Coming Soon

We're actively working on official support for these validation libraries:

- **Zod** - Most popular TypeScript validation library
- **Typebox** - JSON Schema-based validation with excellent performance
- **ArkType** - Next-generation TypeScript validation with 1:1 syntax

Want to see support for another library? [Open an issue](https://github.com/tonyfromundefined/ventyd/issues) to let us know!

## Storage Adapter Implementations

### In-Memory Storage Adapter

Perfect for development and testing:

```typescript
import type { Adapter } from 'ventyd';

const createInMemoryAdapter = (): Adapter => {
  const events: any[] = [];

  return {
    async getEventsByEntityId({ entityName, entityId }) {
      return events.filter(e =>
        e.entityName === entityName &&
        e.entityId === entityId
      );
    },
    async commitEvents({ events: newEvents }) {
      events.push(...newEvents);
    }
  };
};

const adapter = createInMemoryAdapter();
```

### MongoDB Storage Adapter

For production deployments:

```typescript
import type { Adapter } from 'ventyd';
import { MongoClient } from 'mongodb';

const createMongoDBAdapter = (uri: string, dbName: string): Adapter => {
  const client = new MongoClient(uri);
  const db = client.db(dbName);
  const eventsCollection = db.collection('events');

  return {
    async getEventsByEntityId({ entityName, entityId }) {
      return eventsCollection
        .find({ entityName, entityId })
        .sort({ eventCreatedAt: 1 })
        .toArray();
    },
    async commitEvents({ events }) {
      if (events.length > 0) {
        await eventsCollection.insertMany(events);
      }
    }
  };
};

const adapter = createMongoDBAdapter('mongodb://localhost:27017', 'myapp');
```

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

- Always use the `mutation()` helper for methods that dispatch events
- Validate business rules before dispatching
- Access entity state via `this` for validation logic

```typescript
import { Entity, mutation } from 'ventyd';

class Order extends Entity(orderSchema, orderReducer) {
  ship = mutation(this, (dispatch, trackingNumber: string) => {
    // Validate using entity state via this
    if (this.state.status !== "confirmed") {
      throw new OrderNotConfirmedError(
        `Order ${this.entityId} must be confirmed before shipping`
      );
    }

    if (!trackingNumber) {
      throw new InvalidTrackingNumberError(
        "Tracking number is required for shipment"
      );
    }

    // Safe to dispatch after validation
    dispatch("order:shipped", { trackingNumber });
  });
}
```

### 4. Error Handling

- Validate business rules before dispatching events
- Use domain-specific exceptions
- Never modify state directly
- Mutation methods automatically enforce readonly constraints

## License

MIT

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## Support

For questions and support, please open an issue on GitHub.
