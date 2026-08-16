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
 * Best-effort structural JSON Schema conversion for Zod v3 schemas, which lack a
 * native `toJSONSchema` API. Walks the internal `_def` shape that v3 exposes.
 */
export function zodV3ToJsonSchema(schema: unknown): Record<string, unknown> {
  const def = (schema as { _def?: { typeName?: string; [key: string]: unknown } })._def;
  if (!def) {
    return { type: 'object' };
  }

  switch (def['typeName']) {
    case 'ZodObject': {
      const shape = (def['shape'] as () => Record<string, unknown>)();
      const properties: Record<string, unknown> = {};
      const required: string[] = [];
      for (const [key, value] of Object.entries(shape)) {
        properties[key] = zodV3ToJsonSchema(value);
        if (!isZodV3Optional(value)) {
          required.push(key);
        }
      }
      return {
        type: 'object',
        properties,
        ...(required.length > 0 ? { required } : {}),
      };
    }
    case 'ZodString':
      return { type: 'string' };
    case 'ZodNumber':
      return { type: 'number' };
    case 'ZodBoolean':
      return { type: 'boolean' };
    case 'ZodDate':
      return { type: 'string', format: 'date-time' };
    case 'ZodArray':
      return { type: 'array', items: zodV3ToJsonSchema(def['type']) };
    case 'ZodEnum':
      return { type: 'string', enum: def['values'] };
    case 'ZodNativeEnum':
      return { enum: Object.values(def['values'] as Record<string, unknown>) };
    case 'ZodLiteral':
      return { const: def['value'] };
    case 'ZodOptional':
    case 'ZodNullable':
    case 'ZodDefault':
      return zodV3ToJsonSchema(def['innerType']);
    case 'ZodEffects':
      return zodV3ToJsonSchema(def['schema']);
    case 'ZodUnion':
      return { anyOf: (def['options'] as unknown[]).map((option) => zodV3ToJsonSchema(option)) };
    case 'ZodRecord':
      return { type: 'object', additionalProperties: zodV3ToJsonSchema(def['valueType']) };
    default:
      return { type: 'object' };
  }
}

function isZodV3Optional(schema: unknown): boolean {
  const typeName = (schema as { _def?: { typeName?: string } })._def?.typeName;
  return typeName === 'ZodOptional' || typeName === 'ZodDefault';
}

/**
 * Converts a Zod schema into a JSON Schema object accepted by Ollama's `format` parameter.
 *
 * Uses Zod v4's native `z.toJSONSchema` when available, falling back to a structural
 * walk of Zod v3's internal `_def` shape so both major versions work as peer dependencies.
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

  return zodV3ToJsonSchema(schema);
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
