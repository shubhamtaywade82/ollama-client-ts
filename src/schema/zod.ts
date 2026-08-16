/**
 * Zod schema conversion to JSON Schema for Ollama structured outputs.
 */

import { z } from 'zod';
import { OllamaToolValidationError } from '../errors.js';

export type SupportedSchema<T = unknown> = z.ZodType<T>;

function extractJsonSubstring(text: string): string {
  const trimmed = text.trim();
  if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
    return trimmed;
  }
  const match = trimmed.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
  if (match && match[1]) {
    return match[1].trim();
  }
  const firstBrace = trimmed.indexOf('{');
  const lastBrace = trimmed.lastIndexOf('}');
  if (firstBrace !== -1 && lastBrace > firstBrace) {
    return trimmed.slice(firstBrace, lastBrace + 1);
  }
  return trimmed;
}

/**
 * Converts a Zod schema into a JSON Schema object accepted by Ollama's `format` parameter.
 */
export function zodToJsonSchema<T>(schema: z.ZodType<T>): Record<string, unknown> {
  if (
    typeof (z as { toJSONSchema?: (s: z.ZodType<T>) => Record<string, unknown> }).toJSONSchema ===
    'function'
  ) {
    return (
      z as unknown as { toJSONSchema: (s: z.ZodType<T>) => Record<string, unknown> }
    ).toJSONSchema(schema);
  }

  try {
    return (
      (schema as unknown as { jsonSchema?: Record<string, unknown> }).jsonSchema ?? {
        type: 'object',
      }
    );
  } catch {
    return { type: 'object' };
  }
}

/**
 * Parses and validates a JSON output string against a Zod schema.
 */
export function parseStructuredOutput<T>(
  rawJson: string,
  schema: z.ZodType<T>,
  toolName = 'structured_output',
): T {
  let parsed: unknown;
  const jsonStr = extractJsonSubstring(rawJson);
  try {
    parsed = JSON.parse(jsonStr);
  } catch (err) {
    throw new OllamaToolValidationError(`Failed to parse structured output as JSON: ${rawJson}`, {
      toolName,
      cause: err,
    });
  }

  const result = schema.safeParse(parsed);
  if (!result.success) {
    throw new OllamaToolValidationError(`Structured output failed schema validation`, {
      toolName,
      issues: result.error.issues,
      cause: result.error,
    });
  }

  return result.data;
}
