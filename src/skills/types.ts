/**
 * SKILL.md frontmatter and skill registry types.
 */

export interface SkillFrontmatter {
  readonly name: string;
  readonly description: string;
  readonly 'allowed-tools'?: readonly string[] | undefined;
  readonly [key: string]: unknown;
}

export interface SkillSummary {
  readonly name: string;
  readonly description: string;
  readonly path: string;
}

export interface Skill extends SkillSummary {
  readonly frontmatter: SkillFrontmatter;
  readonly body: string;
  readonly allowedTools?: readonly string[] | undefined;
}
