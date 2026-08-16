/**
 * Lightweight frontmatter parser for SKILL.md files.
 */

import { OllamaSkillInvalidError } from '../errors.js';
import type { SkillFrontmatter } from './types.js';

export interface ParsedFrontmatter {
  readonly frontmatter: SkillFrontmatter;
  readonly body: string;
}

function parseYamlValue(raw: string): unknown {
  const trimmed = raw.trim();
  if (trimmed === 'true') return true;
  if (trimmed === 'false') return false;
  if (!Number.isNaN(Number(trimmed)) && trimmed !== '') return Number(trimmed);
  if (
    (trimmed.startsWith('"') && trimmed.endsWith('"')) ||
    (trimmed.startsWith("'") && trimmed.endsWith("'"))
  ) {
    return trimmed.slice(1, -1);
  }
  return trimmed;
}

function parseYamlBlock(yamlText: string): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  const lines = yamlText.split('\n');
  let currentKey: string | undefined;
  let currentList: unknown[] | undefined;

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;

    if (trimmed.startsWith('- ') && currentKey) {
      if (!currentList) {
        currentList = [];
        result[currentKey] = currentList;
      }
      currentList.push(parseYamlValue(trimmed.slice(2)));
      continue;
    }

    currentList = undefined;
    const colonIndex = line.indexOf(':');
    if (colonIndex > 0) {
      const key = line.slice(0, colonIndex).trim();
      const valStr = line.slice(colonIndex + 1).trim();
      currentKey = key;
      if (valStr.length > 0) {
        result[key] = parseYamlValue(valStr);
      }
    }
  }

  return result;
}

export function parseFrontmatter(source: string, path = ''): ParsedFrontmatter {
  const match = source.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/);
  if (!match) {
    throw new OllamaSkillInvalidError('Missing YAML frontmatter delimiters (---)', {
      skillName: path || 'unknown',
      path,
    });
  }

  const rawYaml = match[1] ?? '';
  const body = match[2]?.trim() ?? '';
  const parsed = parseYamlBlock(rawYaml);

  if (!parsed['name'] || typeof parsed['name'] !== 'string') {
    throw new OllamaSkillInvalidError('Frontmatter missing required string "name"', {
      skillName: String(parsed['name'] ?? 'unknown'),
      path,
    });
  }
  if (!parsed['description'] || typeof parsed['description'] !== 'string') {
    throw new OllamaSkillInvalidError('Frontmatter missing required string "description"', {
      skillName: parsed['name'],
      path,
    });
  }

  return {
    frontmatter: parsed as unknown as SkillFrontmatter,
    body,
  };
}
