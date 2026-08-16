# ollama-client-ts

> A modern, production-grade TypeScript SDK for Ollama. Native `fetch`, zero runtime dependencies (except Zod for validation), retries, timeouts, middleware, structured streaming, tool-calling, MCP support, and structured outputs.

---

## Features

- 🚀 **Native Web Standards**: Built on global `fetch` and standard web streams. Zero bloated external HTTP clients.
- 🔒 **TypeScript-First**: Strict type checking with exact types, full autocomplete, and typed error hierarchy.
- ⚡ **Structured Streaming**: `OllamaStream` with both `for await (...)` async iteration and `.on('token', ...)` events.
- 🛠️ **Type-Safe Tools**: `defineTool` with automatic Zod-to-JSON-Schema conversion and validated arguments.
- 🔌 **Model Context Protocol (MCP)**: Native support for loading and registering MCP tools.
- 🤖 **Agent Loop**: Composable multi-turn autonomous tool-calling agent with turn events and token hooks.
- 🌐 **Multi-Endpoint Failover**: Built-in circuit breaker, priority routing, and automatic failover across local/cloud Ollama servers.
- 🎯 **Structured Outputs**: Zod-powered validation and parsing (`chatWithSchema`, `generateWithSchema`).
- ⏱️ **Resilience**: Configurable exponential backoff retries with full jitter, per-request timeouts, and cancellation.
- 📦 **Dual Output**: Shipped as both pure ESM (`dist/index.js`) and CommonJS (`dist/index.cjs`) with complete `.d.ts` declaration maps.

---

## Installation

```bash
npm install ollama-client-ts zod
```

---

## Quick Start

### Basic Chat & Generate

```typescript
import { OllamaClient } from 'ollama-client-ts';

const client = new OllamaClient();

// Simple text convenience helper
const answer = await client.chatText({
  model: 'llama3.2',
  messages: [{ role: 'user', content: 'Why is the sky blue?' }],
});
console.log(answer);
```

### Real-Time Streaming

```typescript
const stream = await client.chatStream({
  model: 'llama3.2',
  messages: [{ role: 'user', content: 'Write a haiku about TypeScript.' }],
});

// Async iterator consumption
for await (const event of stream) {
  if (event.type === 'token') {
    process.stdout.write(event.data.delta);
  }
}

// Access full aggregated result and token stats once finished
const final = await stream.finalResult;
console.log(`\nTokens/sec: ${final.usage?.tokensPerSecond}`);
```

### Structured Outputs with Zod

```typescript
import { z } from 'zod';

const PersonSchema = z.object({
  name: z.string(),
  age: z.number(),
  hobbies: z.array(z.string()),
});

const person = await client.chatWithSchema(
  {
    model: 'llama3.2',
    messages: [{ role: 'user', content: 'Generate a fictional software engineer profile.' }],
  },
  PersonSchema,
);

console.log(person.name, person.hobbies);
```

### Tool Calling & Agent Loop

```typescript
import { Agent, defineTool, ToolRegistry } from 'ollama-client-ts';
import { z } from 'zod';

const searchDatabase = defineTool({
  name: 'search_db',
  description: 'Search user database by query',
  schema: z.object({ query: z.string() }),
  execute: async ({ query }) => {
    return [
      { id: 1, name: 'Alice' },
      { id: 2, name: 'Bob' },
    ];
  },
});

const tools = new ToolRegistry();
tools.register(searchDatabase);

const agent = new Agent(client, { tools, maxIterations: 5 });

const result = await agent.run({
  model: 'llama3.2',
  messages: [{ role: 'user', content: 'Find users matching "Alice"' }],
});

console.log(result.finalMessage.content);
```

### Multi-Endpoint Failover

```typescript
const client = new OllamaClient({
  endpoints: [
    { name: 'local-gpu', baseUrl: 'http://localhost:11434', priority: 10 },
    {
      name: 'cloud-fallback',
      baseUrl: 'https://ollama.example.com',
      apiKey: 'secret',
      priority: 5,
    },
  ],
  timeoutMs: 15_000,
  retries: 3,
});
```

---

## License

MIT © shubhamtaywade82
