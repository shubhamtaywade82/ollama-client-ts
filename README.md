# @shubhamtaywade82/ollama-client-ts

[![CI](https://github.com/shubhamtaywade82/ollama-client-ts/actions/workflows/ci.yml/badge.svg)](https://github.com/shubhamtaywade82/ollama-client-ts/actions/workflows/ci.yml)
[![npm version](https://img.shields.io/npm/v/@shubhamtaywade82/ollama-client-ts.svg)](https://www.npmjs.com/package/@shubhamtaywade82/ollama-client-ts)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://opensource.org/licenses/MIT)

> Production-grade TypeScript SDK for Ollama. Built with native fetch, high availability failover, multi-turn tool calling, structured outputs with Zod, reasoning stream tokens, OpenAI & Anthropic compatibility bridges, MCP integration, and Web Stream adapters.

---

## Key Features

- 🚀 **Native Web Standards**: Built on native `fetch` and Web Streams. Zero external HTTP dependencies.
- 🧠 **Reasoning & Thinking Tokens**: First-class support for reasoning models (`qwen3.5:2b`, `deepseek-r1`) with discrete `thinking` and `token` streaming events.
- 🎯 **Zod-Powered Structured Outputs**: Strictly typed schema enforcement via `chatWithSchema` and `generateWithSchema` with resilient markdown JSON parsing.
- 🛠️ **Autonomous Agent & Tool Calling**: Multi-turn agent loop (`Agent`) with automated tool execution, parameter validation, and self-correcting error recovery.
- 🌐 **High Availability & Failover**: Multi-endpoint registry with priority routing, circuit breaker failover, and active health checks.
- 🔌 **Model Context Protocol (MCP)**: Native adapters to convert MCP tools into Ollama-compatible function schemas.
- 🌉 **OpenAI & Anthropic Compatibility Bridges**: Built-in clients for `/v1/chat/completions`, `/v1/models`, and `/v1/messages`.
- 🌊 **Web Stream Adapters**: Drop-in adapters (`toTextStream`, `toDataStream`, `toResponse`) for Next.js Route Handlers and Vercel AI SDK.
- 📦 **Dual ESM & CJS Build**: Full module support with clean TypeScript `.d.ts` declaration maps.

---

## Installation

```bash
npm install @shubhamtaywade82/ollama-client-ts zod
```

`zod` is a peer dependency (`^3.22.0 || ^4.0.0`) — install whichever major version your project already uses instead of getting a second copy bundled in.

---

## Quick Start

### Basic Chat & Completion

```typescript
import { OllamaClient } from '@shubhamtaywade82/ollama-client-ts';

const client = new OllamaClient();

// Text helper
const answer = await client.chatText({
  model: 'qwen3.5:2b',
  messages: [{ role: 'user', content: 'Explain quantum computing in one sentence.' }],
});
console.log(answer);
```

### Thinking & Reasoning Token Streams

```typescript
const stream = await client.chatStream({
  model: 'qwen3.5:2b',
  messages: [{ role: 'user', content: 'What is 18 * 4?' }],
  options: { temperature: 0 },
});

for await (const event of stream) {
  if (event.type === 'thinking') {
    process.stdout.write(`\x1b[33m${event.data.delta}\x1b[0m`); // Thinking trace
  } else if (event.type === 'token') {
    process.stdout.write(event.data.delta); // Final answer token
  }
}

const final = await stream.finalResult;
console.log(`\nEval tokens/sec: ${final.usage?.tokensPerSecond}`);
```

### Structured Outputs with Zod

```typescript
import { z } from 'zod';

const ProductSchema = z.object({
  name: z.string(),
  category: z.enum(['electronics', 'books', 'apparel']),
  price: z.number(),
  tags: z.array(z.string()),
});

const product = await client.chatWithSchema(
  {
    model: 'qwen3.5:2b',
    messages: [{ role: 'user', content: 'Generate a gaming keyboard item.' }],
  },
  ProductSchema,
);

console.log(product.name, product.price);
```

### Vector Embeddings & Similarity

```typescript
const res = await client.embed({
  model: 'nomic-embed-text:latest',
  input: [
    'Machine learning and neural networks',
    'Artificial intelligence algorithms',
    'Baking traditional French sourdough bread',
  ],
});

console.log(`Generated ${res.embeddings.length} vectors with dimension ${res.embeddings[0].length}`);
```

### Autonomous Agent & Tool Calling

```typescript
import { Agent, defineTool, ToolRegistry, OllamaClient } from '@shubhamtaywade82/ollama-client-ts';
import { z } from 'zod';

const client = new OllamaClient();

const weatherTool = defineTool({
  name: 'get_weather',
  description: 'Get the current weather for a city',
  schema: z.object({ city: z.string() }),
  execute: async ({ city }) => ({ city, temperature: '22°C', condition: 'Sunny' }),
});

const registry = new ToolRegistry([weatherTool]);
const agent = new Agent(client, { tools: registry, maxTurns: 5 });

const response = await agent.run({
  model: 'qwen3.5:2b',
  messages: [{ role: 'user', content: 'What is the weather in Tokyo?' }],
});

console.log(response.finalMessage.content);
```

### Web Standard Streams & Next.js Integration

```typescript
import { toResponse } from '@shubhamtaywade82/ollama-client-ts';

export async function POST(req: Request) {
  const { messages } = await req.json();
  const stream = await client.chatStream({
    model: 'qwen3.5:2b',
    messages,
  });

  return toResponse(stream);
}
```

### OpenAI & Anthropic Compatibility Bridges

```typescript
// OpenAI compatibility endpoint (/v1/chat/completions)
const openAIRes = await client.openai.chatCompletions({
  model: 'llama3.2',
  messages: [{ role: 'user', content: 'Hello via OpenAI bridge' }],
});

// Anthropic compatibility endpoint (/v1/messages)
const anthropicRes = await client.anthropic.messages({
  model: 'llama3.2',
  messages: [{ role: 'user', content: 'Hello via Anthropic bridge' }],
});
```

### Multi-Endpoint High Availability Failover

```typescript
const client = new OllamaClient({
  endpoints: [
    { name: 'local-gpu', baseUrl: 'http://localhost:11434', priority: 10 },
    { name: 'cloud-replica', baseUrl: 'https://ollama.internal.net', apiKey: 'secret', priority: 5 },
  ],
  timeoutMs: 30_000,
  retries: 3,
});

// Active health check probe
const health = await client.healthCheck();
console.log(health);
```

---

## Error Handling

Every failure thrown by the client is an `OllamaClientError` subclass, so you can catch the base
class or narrow to a specific `code`:

| Class | `code` | `retryable` | Thrown when |
| --- | --- | --- | --- |
| `OllamaNetworkError` | `network_error` | `true` | The request failed before a response was received (DNS, connection refused, etc). |
| `OllamaTimeoutError` | `timeout` | `true` | The request exceeded `timeoutMs`. |
| `OllamaAuthError` | `auth_error` | `false` | The endpoint returned `401`/`403`. |
| `OllamaNotFoundError` | `not_found` | `false` | The endpoint returned `404` (e.g. unknown model). |
| `OllamaRateLimitError` | `rate_limited` | `true` | The endpoint returned `429`. |
| `OllamaServerError` | `server_error` | `true` | The endpoint returned `5xx`. |
| `OllamaAbortError` | `aborted` | `false` | The request was cancelled via `AbortSignal`. |
| `OllamaToolValidationError` | `tool_validation_error` | `false` | A tool call's arguments, or a `chatWithSchema`/`generateWithSchema` result, failed Zod validation. |
| `OllamaAgentMaxIterationsError` | `agent_max_iterations_exceeded` | `false` | An `Agent` run exceeded `maxTurns` without producing a final answer. |
| `OllamaMcpError` | `mcp_error` | varies | An MCP `listTools`/`callTool` call failed. |
| `OllamaSkillNotFoundError` | `skill_not_found` | `false` | `applySkill` referenced a skill that isn't registered. |
| `OllamaSkillInvalidError` | `skill_invalid` | `false` | A skill's frontmatter or contents failed to parse. |
| `OllamaGenericClientError` | `client_error` | `false` | Any other non-2xx response not covered above. |

All subclasses carry `status`, `retryable`, and optional `request`/`response` context, and preserve
the original error via the standard `cause` property:

```typescript
import { OllamaClientError, OllamaRateLimitError } from '@shubhamtaywade82/ollama-client-ts';

try {
  await client.chatText({ model: 'qwen3.5:2b', messages: [...] });
} catch (err) {
  if (err instanceof OllamaRateLimitError) {
    console.warn(`Rate limited, retry after ${err.retryAfterMs}ms`);
  } else if (err instanceof OllamaClientError) {
    console.error(`[${err.code}] ${err.message}`, { retryable: err.retryable, cause: err.cause });
  } else {
    throw err;
  }
}
```

Multi-endpoint failover (`endpoints: [...]`) fails open rather than throwing a dedicated
"circuit open" error: once an endpoint's failure count crosses `failureThreshold`, it's skipped in
favor of healthy endpoints for `cooldownMs`, and only used again — sorted soonest-to-recover — if
every endpoint is cooling down. Call `client.healthCheck()` or inspect the registry's `status()` to
observe per-endpoint circuit state directly.

---

## Testing

The test suite contains 50 automated tests across 4 testing tiers:

```bash
# Run unit, integration, and functional test suite
npm test

# Run typechecker
npm run typecheck

# Run linter
npm run lint

# Run full CI verification pipeline
npm run verify
```

---

## License

MIT © [Shubham Taywade](https://github.com/shubhamtaywade82)
