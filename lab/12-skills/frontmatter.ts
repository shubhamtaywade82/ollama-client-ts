import { parseFrontmatter } from '../../src/index.js';
import { labLogger } from '../support/logger.js';

const markdownSkillDoc = `---
name: code-reviewer
description: Rigorous code quality reviewer following KISS/YAGNI principles.
version: 1.0.0
tools:
  - git_diff
  - run_linter
---

# Code Reviewer Skill
Analyze pull requests for over-abstraction and unhandled edge cases.
`;

async function main(): Promise<void> {
  const parsed = parseFrontmatter(markdownSkillDoc);

  await labLogger.log({
    experimentId: '12-skills-frontmatter',
    timestamp: new Date().toISOString(),
    provider: 'skills-parser',
    endpoint: 'local-memory',
    model: 'markdown-doc',
    operation: 'parseFrontmatter',
    response: {
      frontmatter: parsed.frontmatter,
      body: parsed.body,
    },
  });
}

void main();
