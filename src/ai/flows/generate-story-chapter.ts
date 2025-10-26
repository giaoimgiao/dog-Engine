'use server';

/**
 * @fileOverview Generates a story chapter based on user input and context.
 *
 * - generateStoryChapter - A function that generates a story chapter.
 * - GenerateStoryChapterInput - The input type for the generateStoryChapter function.
 * - GenerateStoryChapterOutput - The return type for the generateStoryChapter function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const GenerateStoryChapterInputSchema = z.object({
  prompt: z.string().describe('The prompt for the story chapter.'),
  context: z.string().optional().describe('Additional context for the story chapter.'),
  aiCharacter: z.string().optional().describe('The persona that the AI should assume'),
});
export type GenerateStoryChapterInput = z.infer<typeof GenerateStoryChapterInputSchema>;

const GenerateStoryChapterOutputSchema = z.object({
  chapterText: z.string().describe('The generated story chapter text.'),
});
export type GenerateStoryChapterOutput = z.infer<typeof GenerateStoryChapterOutputSchema>;

export async function generateStoryChapter(input: GenerateStoryChapterInput): Promise<GenerateStoryChapterOutput> {
  return generateStoryChapterFlow(input);
}

const prompt = ai.definePrompt({
  name: 'generateStoryChapterPrompt',
  input: {schema: GenerateStoryChapterInputSchema},
  output: {schema: GenerateStoryChapterOutputSchema},
  prompt: `You are a creative story writer.

  @persona
  {{aiCharacter}}

  Write a story chapter based on the following prompt:
  {{prompt}}

  Here is some context that might be helpful:
  {{context}}`,
});

const generateStoryChapterFlow = ai.defineFlow(
  {
    name: 'generateStoryChapterFlow',
    inputSchema: GenerateStoryChapterInputSchema,
    outputSchema: GenerateStoryChapterOutputSchema,
  },
  async input => {
    const {output} = await prompt(input);
    return output!;
  }
);
