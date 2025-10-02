# Ventyd

A TypeScript-first event sourcing library with full type safety and flexible storage backends.

## Features

- **Type-Safe Event Sourcing**: Full TypeScript support with Zod schema validation
- **Multiple Storage Backends**: In-memory, MongoDB, SQLite, and custom storage adapters
- **Event-Driven Architecture**: Capture all state changes as immutable events
- **Time Travel**: Reconstruct entity state at any point in history
- **Lightweight**: Minimal dependencies, focused on core functionality

## Installation

```bash
npm install ventyd
# or
yarn add ventyd
# or
pnpm add ventyd
```

## Quick Start

### 1. Define Your Schema

Define your entity's events and state structure using Zod schemas:

```typescript
import { z, defineSchema } from 'ventyd';

const userSchema = defineSchema("user", {
  // Define all possible events
  event: {
    created: z.object({
      nickname: z.string(),
      email: z.string().email(),
    }),
    profile_updated: z.object({
      nickname: z.string().optional(),
      bio: z.string().optional(),
    }),
    deleted: z.object({
      reason: z.string().optional(),
    }),
    restored: z.object({}),
  },
  // Define the entity state structure
  state: z.object({
    nickname: z.string(),
    email: z.string().email(),
    bio: z.string().optional(),
    deletedAt: z.string().optional().nullable(),
  }),
  // Specify which event initializes the entity
  initialEventName: "created",
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

Extend the Entity base class and add business logic:

```typescript
import { Entity } from 'ventyd';

class User extends Entity(userSchema, userReducer) {
  // Getters for convenient access
  get nickname() {
    return this.state.nickname;
  }

  get isDeleted() {
    return this.state.deletedAt !== null;
  }

  // Business methods with validation
  updateProfile(updates: { nickname?: string; bio?: string }) {
    if (this.isDeleted) {
      throw new Error("Cannot update profile of deleted user");
    }
    this.dispatch("user:x", updates);
  }

  delete(reason?: string) {
    if (this.isDeleted) {
      throw new Error("User is already deleted");
    }
    this.dispatch("user:deleted", { reason });
  }

  restore() {
    if (!this.isDeleted) {
      throw new Error("User is not deleted");
    }
    this.dispatch("user:restored", {});
  }
}
```

### 4. Set Up Storage and Repository

Configure your storage backend and create a repository:

```typescript
import { createRepository, defineStorage } from 'ventyd';

// Use in-memory storage for development
const storage = defineStorage({
  async getEventsByEntityId({ entityName, entityId }) {
    // Implementation for retrieving events
    return events.filter(e =>
      e.entityName === entityName &&
      e.entityId === entityId
    );
  },
  async commitEvents({ events }) {
    // Implementation for storing events
    eventStore.push(...events);
  }
});

// Create a repository for your entity
const userRepository = createRepository({
  schema: userSchema,
  entity: User,
  storage,
});
```

### 5. Use Your Event-Sourced Entity

```typescript
// Create a new user
const user = new User({
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

## Storage Backends

### In-Memory Storage

Perfect for development and testing:

```typescript
const events: any[] = [];

const storage = defineStorage({
  async getEventsByEntityId({ entityName, entityId }) {
    return events.filter(e =>
      e.entityName === entityName &&
      e.entityId === entityId
    );
  },
  async commitEvents({ events: newEvents }) {
    events.push(...newEvents);
  }
});
```

### MongoDB Storage

For production deployments:

```typescript
import { MongoClient } from 'mongodb';

const client = new MongoClient('mongodb://localhost:27017');
const db = client.db('myapp');
const eventsCollection = db.collection('events');

const storage = defineStorage({
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
});
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

### 3. Error Handling

- Validate business rules before dispatching events
- Use domain-specific exceptions
- Never modify state directly

```typescript
class Order extends Entity(orderSchema, orderReducer) {
  ship(trackingNumber: string) {
    // Validate before dispatching
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
    this.dispatch("order:shipped", { trackingNumber });
  }
}
```

## License

MIT

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## Support

For questions and support, please open an issue on GitHub.
