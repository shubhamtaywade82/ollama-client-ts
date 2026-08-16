import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { parseStructuredOutput, zodToJsonSchema, zodV3ToJsonSchema } from '../src/schema/zod.js';
import { parseFrontmatter } from '../src/skills/frontmatter.js';
import { applySkill } from '../src/skills/compose.js';
import { OllamaToolValidationError } from '../src/errors.js';

describe('Unit: Schema & Skills', () => {
  describe('zodToJsonSchema & parseStructuredOutput', () => {
    it('converts Zod objects, enums, numbers, and arrays into JSON Schema', () => {
      const schema = z.object({
        name: z.string(),
        role: z.enum(['admin', 'user']),
        age: z.number().optional(),
        skills: z.array(z.string()),
      });

      const jsonSchema = zodToJsonSchema(schema) as Record<string, unknown>;
      expect(jsonSchema['type']).toBe('object');
      const properties = jsonSchema['properties'] as Record<string, Record<string, unknown>>;
      expect(properties['name']?.['type']).toBe('string');
      expect(properties['role']?.['enum']).toEqual(['admin', 'user']);
      expect(properties['skills']?.['type']).toBe('array');
    });

    it('falls back to a structural walk of the Zod v3 `_def` shape when `z.toJSONSchema` is unavailable', () => {
      // Simulates a Zod v3 schema instance: v3 has no `z.toJSONSchema`, and its
      // internal `_def.typeName` shape differs from v4's `_zod.def`.
      const v3StringSchema = { _def: { typeName: 'ZodString' } };
      const v3OptionalNumberSchema = {
        _def: { typeName: 'ZodOptional', innerType: { _def: { typeName: 'ZodNumber' } } },
      };
      const v3EnumSchema = { _def: { typeName: 'ZodEnum', values: ['admin', 'user'] } };
      const v3ArraySchema = { _def: { typeName: 'ZodArray', type: v3StringSchema } };
      const v3ObjectSchema = {
        _def: {
          typeName: 'ZodObject',
          shape: () => ({
            name: v3StringSchema,
            role: v3EnumSchema,
            age: v3OptionalNumberSchema,
            skills: v3ArraySchema,
          }),
        },
      };

      const jsonSchema = zodV3ToJsonSchema(v3ObjectSchema);
      expect(jsonSchema['type']).toBe('object');
      const properties = jsonSchema['properties'] as Record<string, Record<string, unknown>>;
      expect(properties['name']?.['type']).toBe('string');
      expect(properties['role']?.['enum']).toEqual(['admin', 'user']);
      expect(properties['skills']?.['type']).toBe('array');
      expect(jsonSchema['required']).toEqual(['name', 'role', 'skills']);
    });

    it('extracts and parses structured output from markdown code blocks', () => {
      const schema = z.object({ score: z.number(), reasoning: z.string() });
      const rawResponse =
        'Here is the score:\n```json\n{"score": 95, "reasoning": "Excellent quality"}\n```\nHope that helps!';

      const parsed = parseStructuredOutput(rawResponse, schema);
      expect(parsed.score).toBe(95);
      expect(parsed.reasoning).toBe('Excellent quality');
    });

    it('throws OllamaToolValidationError on invalid JSON content', () => {
      const schema = z.object({ score: z.number() });
      const invalidResponse = 'Sorry, cannot compute score right now.';

      expect(() => parseStructuredOutput(invalidResponse, schema)).toThrow(
        OllamaToolValidationError,
      );
    });
  });

  describe('Skills: Frontmatter & Composition', () => {
    it('parses YAML frontmatter metadata, variables, and body content', () => {
      const rawSkill = `---
name: code-reviewer
description: Reviews code diffs for quality
version: 1.0.0
tags:
  - review
  - quality
---
You are an expert reviewer. Review the following code for language:
\`\`\`
code
\`\`\`
`;
      const skill = parseFrontmatter(rawSkill);
      expect(skill.frontmatter.name).toBe('code-reviewer');
      expect(skill.frontmatter.description).toBe('Reviews code diffs for quality');
      expect(skill.frontmatter.tags).toEqual(['review', 'quality']);
      expect(skill.body).toContain('Review the following code for language');
    });

    it('applies skill into system message correctly', () => {
      const skill = {
        name: 'translator',
        description: 'Translates text',
        body: 'Translate the following input to French.',
      };

      const result = applySkill(skill, {
        messages: [{ role: 'user', content: 'Good morning' }],
      });

      expect(result.messages.length).toBe(2);
      expect(result.messages[0]?.role).toBe('system');
      expect(result.messages[0]?.content).toContain('[Skill: translator]');
      expect(result.messages[0]?.content).toContain('Translate the following input to French.');
      expect(result.messages[1]?.content).toBe('Good morning');
    });
  });
});
