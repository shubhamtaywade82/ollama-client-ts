import { loadMcpTools, type McpClientLike, OllamaClient, ToolRegistry } from '../../src/index.js';
import { getLabEnv } from '../support/env.js';
import { labLogger } from '../support/logger.js';

// Mock McpClient complying with McpClientLike
const mockMcpClient: McpClientLike = {
  listTools: async () => ({
    tools: [
      {
        name: 'mcp_calc',
        description: 'MCP Calculator tool for evaluating arithmetic expressions',
        inputSchema: {
          type: 'object',
          properties: {
            expression: { type: 'string', description: 'Mathematical expression' },
          },
          required: ['expression'],
        },
      },
    ],
  }),
  callTool: async ({ name, arguments: args }) => {
    if (name === 'mcp_calc') {
      const expr = String(args?.['expression'] ?? '0');
      return {
        content: [{ type: 'text', text: `Calculation result for "${expr}": 42` }],
      };
    }
    return { isError: true, content: [{ type: 'text', text: 'Unknown MCP tool' }] };
  },
};

async function main(): Promise<void> {
  const env = getLabEnv();
  const client = new OllamaClient({ baseUrl: env.localBaseUrl });
  const mcpTools = await loadMcpTools(mockMcpClient);
  const registry = new ToolRegistry(mcpTools);
  const start = Date.now();

  try {
    const res = await client.chat({
      model: env.localModel,
      messages: [{ role: 'user', content: 'Use mcp_calc to compute 6 * 7.' }],
      tools: registry.definitions(),
    });

    let toolExecutions: unknown = undefined;
    if (res.message.tool_calls?.length) {
      toolExecutions = await registry.executeToolCalls(res.message.tool_calls);
    }

    await labLogger.log({
      experimentId: '11-mcp-one-tool',
      timestamp: new Date().toISOString(),
      provider: 'mcp-adapter',
      endpoint: env.localBaseUrl,
      model: env.localModel,
      operation: 'mcp-tool-execution',
      durationMs: Date.now() - start,
      toolCalls: res.message.tool_calls as readonly Record<string, unknown>[] | undefined,
      toolResults: toolExecutions as readonly Record<string, unknown>[] | undefined,
    });
  } catch (err) {
    await labLogger.log({
      experimentId: '11-mcp-one-tool',
      timestamp: new Date().toISOString(),
      provider: 'mcp-adapter',
      endpoint: env.localBaseUrl,
      model: env.localModel,
      operation: 'mcp-tool-execution',
      durationMs: Date.now() - start,
      error: (err as Error).message,
    });
  }
}

void main();
