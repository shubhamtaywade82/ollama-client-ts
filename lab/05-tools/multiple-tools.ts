import { z } from 'zod';
import { defineTool, OllamaClient, ToolRegistry } from '../../src/index.js';
import { getLabEnv } from '../support/env.js';
import { labLogger } from '../support/logger.js';

const getWeatherTool = defineTool({
  name: 'get_weather',
  description: 'Get temperature and conditions for a city',
  schema: z.object({ city: z.string() }),
  execute: async ({ city }) => ({ city, tempC: 24, condition: 'Clear' }),
});

const getStockTool = defineTool({
  name: 'get_stock_price',
  description: 'Get the latest stock price for a symbol',
  schema: z.object({ symbol: z.string() }),
  execute: async ({ symbol }) => ({ symbol, price: 185.5, currency: 'USD' }),
});

async function main(): Promise<void> {
  const env = getLabEnv();
  const client = new OllamaClient({ baseUrl: env.localBaseUrl });
  const registry = new ToolRegistry([getWeatherTool, getStockTool]);
  const start = Date.now();

  try {
    const res = await client.chat({
      model: env.localModel,
      messages: [{ role: 'user', content: 'What is the weather in London?' }],
      tools: registry.definitions(),
    });

    let toolExecutions: unknown = undefined;
    if (res.message.tool_calls?.length) {
      toolExecutions = await registry.executeToolCalls(res.message.tool_calls);
    }

    await labLogger.log({
      experimentId: '05-tools-multiple-tools',
      timestamp: new Date().toISOString(),
      provider: 'local',
      endpoint: env.localBaseUrl,
      model: env.localModel,
      operation: 'chat-multiple-tools-selection',
      durationMs: Date.now() - start,
      response: res.message.content || '(called tool)',
      toolCalls: res.message.tool_calls as readonly Record<string, unknown>[] | undefined,
      toolResults: toolExecutions as readonly Record<string, unknown>[] | undefined,
    });
  } catch (err) {
    await labLogger.log({
      experimentId: '05-tools-multiple-tools',
      timestamp: new Date().toISOString(),
      provider: 'local',
      endpoint: env.localBaseUrl,
      model: env.localModel,
      operation: 'chat-multiple-tools-selection',
      durationMs: Date.now() - start,
      error: (err as Error).message,
    });
  }
}

void main();
