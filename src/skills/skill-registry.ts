/**
 * Node.js filesystem skill registry for SKILL.md packages.
 */

import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { OllamaSkillNotFoundError } from '../errors.js';
import { parseFrontmatter } from './frontmatter.js';
import type { Skill, SkillSummary } from './types.js';

export interface SkillRegistryOptions {
  readonly directory: string;
}

export class SkillRegistry {
  readonly directory: string;

  constructor(options: SkillRegistryOptions) {
    this.directory = options.directory;
  }

  async list(): Promise<SkillSummary[]> {
    const entries = await readdir(this.directory, { withFileTypes: true });
    const summaries: SkillSummary[] = [];

    for (const entry of entries) {
      if (!entry.isDirectory()) continue;
      const skillPath = join(this.directory, entry.name, 'SKILL.md');
      try {
        const content = await readFile(skillPath, 'utf-8');
        const parsed = parseFrontmatter(content, skillPath);
        summaries.push({
          name: parsed.frontmatter.name,
          description: parsed.frontmatter.description,
          path: skillPath,
        });
      } catch {
        // Skip directories without valid SKILL.md
      }
    }

    return summaries;
  }

  async load(name: string): Promise<Skill> {
    const skillPath = join(this.directory, name, 'SKILL.md');
    try {
      const content = await readFile(skillPath, 'utf-8');
      const parsed = parseFrontmatter(content, skillPath);
      return {
        name: parsed.frontmatter.name,
        description: parsed.frontmatter.description,
        path: skillPath,
        frontmatter: parsed.frontmatter,
        body: parsed.body,
        allowedTools: parsed.frontmatter['allowed-tools'],
      };
    } catch (err) {
      throw new OllamaSkillNotFoundError(`Skill "${name}" not found at ${skillPath}`, {
        skillName: name,
        cause: err,
      });
    }
  }
}
