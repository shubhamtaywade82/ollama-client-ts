import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { useVcr } from './vcr.js';

describe('Thorough Structured Output Capabilities', () => {
  const CHAT_MODEL = 'llama3.2:1b';

  it('extracts nested entities with arrays and enum types', async () => {
    await useVcr('thorough_nested_schema', async (client) => {
      const RecipeSchema = z.object({
        recipeName: z.string(),
        difficulty: z.enum(['easy', 'medium', 'hard']),
        cookingTimeMinutes: z.number(),
        ingredients: z.array(
          z.object({
            name: z.string(),
            amount: z.string(),
          }),
        ),
        isVegetarian: z.boolean(),
      });

      const prompt = `Recipe for Pancakes. Difficulty: easy. Cooking time: 15 minutes. Vegetarian: true. Ingredients: Flour (2 cups), Milk (1 cup).`;

      const result = await client.chatWithSchema(
        {
          model: CHAT_MODEL,
          messages: [{ role: 'user', content: prompt }],
          options: { temperature: 0 },
        },
        RecipeSchema,
      );

      expect(result.recipeName.toLowerCase()).toContain('pancake');
      expect(result.difficulty).toBe('easy');
      expect(result.cookingTimeMinutes).toBeGreaterThan(0);
      expect(result.ingredients.length).toBeGreaterThan(0);
    });
  }, 120_000);
});
