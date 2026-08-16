/**
 * Duck-typed MCP (Model Context Protocol) client interfaces.
 * Decoupled from any specific MCP SDK.
 */

export interface McpToolDescriptor {
  readonly name: string;
  readonly description?: string;
  readonly inputSchema?: Record<string, unknown>;
}

export interface McpListToolsResult {
  readonly tools: readonly McpToolDescriptor[];
}

export interface McpContentBlock {
  readonly type: string;
  readonly text?: string;
  readonly [key: string]: unknown;
}

export interface McpCallToolResult {
  readonly content: readonly McpContentBlock[];
  readonly isError?: boolean;
}

export interface McpClientLike {
  listTools: () => Promise<McpListToolsResult>;
  callTool: (params: {
    readonly name: string;
    readonly arguments?: Record<string, unknown>;
  }) => Promise<McpCallToolResult>;
}
