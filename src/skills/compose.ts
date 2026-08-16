/**
 * Skill composition and context injection.
 */

import type { Message } from '../types.js';
import type { ToolRegistry } from '../tools/registry.js';
import type { Skill } from './types.js';

export interface ApplySkillOptions {
  readonly messages: readonly Message[];
  readonly tools?: ToolRegistry;
}

export interface AppliedSkillResult {
  readonly messages: readonly Message[];
  readonly tools?: ToolRegistry;
}

/**
 * Injects a skill's body into messages as a system prompt and applies allowed tool filters.
 */
export function applySkill(skill: Skill, options: ApplySkillOptions): AppliedSkillResult {
  const systemPrompt = `[Skill: ${skill.name}]\n${skill.description}\n\n${skill.body}`;
  const messages = [...options.messages];
  const systemIndex = messages.findIndex((m) => m.role === 'system');

  if (systemIndex >= 0) {
    const existing = messages[systemIndex];
    if (existing) {
      messages[systemIndex] = {
        role: 'system',
        content: `${existing.content}\n\n${systemPrompt}`,
      };
    }
  } else {
    messages.unshift({ role: 'system', content: systemPrompt });
  }

  return {
    messages,
    ...(options.tools !== undefined ? { tools: options.tools } : {}),
  };
}
