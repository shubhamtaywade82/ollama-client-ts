/**
 * Multi-turn tool execution loop agent.
 */

import { OllamaAgentMaxIterationsError } from '../errors.js';
import type { Message, ModelOptions, ToolDefinition } from '../types.js';
import type { ToolRegistry } from '../tools/registry.js';
import type { AgentConfig, AgentHooks, AgentResult, AgentRunInput, AgentTurn } from './types.js';

export interface AgentChatClient {
  chat(request: {
    readonly model: string;
    readonly messages: readonly Message[];
    readonly tools?: readonly ToolDefinition[] | undefined;
    readonly options?: ModelOptions | undefined;
    readonly think?: boolean | 'low' | 'medium' | 'high' | 'max' | undefined;
    readonly stream?: false | undefined;
    readonly signal?: AbortSignal | undefined;
  }): Promise<{ readonly message: Message }>;
}

export class Agent {
  private readonly client: AgentChatClient;
  private readonly tools?: ToolRegistry | undefined;
  private readonly maxIterations: number;
  private readonly hooks?: AgentHooks | undefined;

  constructor(client: AgentChatClient, config: AgentConfig = {}) {
    this.client = client;
    this.tools = config.tools;
    this.maxIterations = config.maxIterations ?? 10;
    this.hooks = config.hooks;
  }

  async run(input: AgentRunInput): Promise<AgentResult> {
    const history: Message[] = [...input.messages];
    const turns: AgentTurn[] = [];
    const toolDefs = this.tools?.definitions();

    for (let iteration = 1; iteration <= this.maxIterations; iteration++) {
      this.hooks?.onTurnStart?.(iteration);

      const response = await this.client.chat({
        model: input.model,
        messages: history,
        ...(toolDefs !== undefined ? { tools: toolDefs } : {}),
        ...(input.options !== undefined ? { options: input.options } : {}),
        ...(input.think !== undefined ? { think: input.think } : {}),
        stream: false,
        ...(input.signal !== undefined ? { signal: input.signal } : {}),
      });

      const assistantMessage = response.message;
      history.push(assistantMessage);

      const toolCalls = assistantMessage.tool_calls;
      if (!toolCalls || toolCalls.length === 0 || !this.tools) {
        const finalTurn: AgentTurn = { iteration, message: assistantMessage };
        turns.push(finalTurn);
        this.hooks?.onTurnEnd?.(finalTurn);
        return { finalMessage: assistantMessage, turns, totalIterations: iteration };
      }

      for (const tc of toolCalls) {
        this.hooks?.onToolCallStart?.(tc);
      }

      const toolResults = await this.tools.executeToolCalls(toolCalls, { signal: input.signal });

      for (const res of toolResults) {
        this.hooks?.onToolCallEnd?.(res);
        history.push({
          role: 'tool',
          content: res.outputString,
        });
      }

      const turn: AgentTurn = { iteration, message: assistantMessage, toolCalls, toolResults };
      turns.push(turn);
      this.hooks?.onTurnEnd?.(turn);
    }

    throw new OllamaAgentMaxIterationsError(
      `Agent exceeded max iterations (${this.maxIterations}) without converging`,
      { maxIterations: this.maxIterations },
    );
  }
}
