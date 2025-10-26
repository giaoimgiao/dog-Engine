// A flow that uses world information and character cards to refine a chapter.

'use server';

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const RefineChapterWithWorldInfoInputSchema = z.object({
  chapterText: z.string().describe('The text of the chapter to refine.'),
  worldInfo: z.string().optional().describe('The world information to use for refining the chapter.'),
  characterCards: z.string().optional().describe('The character cards to use for refining the chapter.'),
  aiRole: z.string().optional().describe('The role of the AI in refining the chapter.'),
});
export type RefineChapterWithWorldInfoInput = z.infer<
  typeof RefineChapterWithWorldInfoInputSchema
>;

const RefineChapterWithWorldInfoOutputSchema = z.object({
  refinedChapterText: z.string().describe('The refined text of the chapter.'),
});
export type RefineChapterWithWorldInfoOutput = z.infer<
  typeof RefineChapterWithWorldInfoOutputSchema
>;

// New schema for deconstructing outline
const DeconstructOutlineInputSchema = z.object({
  chapterContent: z.string().describe('The content of the chapter to deconstruct.'),
  model: z.string().optional().describe('The model to use for the response.'),
});
export type DeconstructOutlineInput = z.infer<typeof DeconstructOutlineInputSchema>;

const DeconstructOutlineOutputSchema = z.object({
  outline: z.string().describe('The generated outline.'),
});
export type DeconstructOutlineOutput = z.infer<typeof DeconstructOutlineOutputSchema>;


export async function refineChapterWithWorldInfo(
  input: RefineChapterWithWorldInfoInput
): Promise<RefineChapterWithWorldInfoOutput> {
  return refineChapterWithWorldInfoFlow(input);
}


export async function deconstructOutline(
  input: DeconstructOutlineInput
): Promise<DeconstructOutlineOutput> {
  return deconstructOutlineFlow(input);
}


const refineChapterWithWorldInfoPrompt = ai.definePrompt({
  name: 'refineChapterWithWorldInfoPrompt',
  input: {schema: RefineChapterWithWorldInfoInputSchema},
  output: {schema: RefineChapterWithWorldInfoOutputSchema},
  prompt: `You are an AI assistant helping an author refine a chapter of their book.

        The author has provided the following chapter text:
        {{chapterText}}

        {{#if worldInfo}}
        The author has also provided the following world information:
        {{worldInfo}}
        {{/if}}

        {{#if characterCards}}
        The author has also provided the following character cards:
        {{characterCards}}
        {{/if}}

        {{#if aiRole}}
        You are playing the role of: {{aiRole}}
        {{/if}}

        Please refine the chapter text, incorporating the world information and character cards where appropriate to maintain consistency and depth. Return only the refined chapter text.
        `,
});

const deconstructOutlinePrompt = ai.definePrompt({
    name: 'deconstructOutlinePrompt',
    input: { schema: DeconstructOutlineInputSchema },
    output: { schema: DeconstructOutlineOutputSchema },
    prompt: `【拆细纲】直接按顺序总结每章的核心剧情。不需要解释。每条剧情前面显示【剧情+序号】
    
    章节内容如下：
    ---
    {{{chapterContent}}}
    ---
    `,
});

const refineChapterWithWorldInfoFlow = ai.defineFlow(
  {
    name: 'refineChapterWithWorldInfoFlow',
    inputSchema: RefineChapterWithWorldInfoInputSchema,
    outputSchema: RefineChapterWithWorldInfoOutputSchema,
  },
  async input => {
    const {output} = await refineChapterWithWorldInfoPrompt(input);
    return {refinedChapterText: output!.refinedChapterText};
  }
);


const deconstructOutlineFlow = ai.defineFlow(
  {
    name: 'deconstructOutlineFlow',
    inputSchema: DeconstructOutlineInputSchema,
    outputSchema: DeconstructOutlineOutputSchema,
  },
  async (input) => {
    const { model, ...promptData } = input;
    const { output } = await deconstructOutlinePrompt(promptData, {
        model: model ? (model as any) : 'googleai/gemini-1.5-flash-latest',
        config: {
            temperature: 0.2,
        }
    });
    return output!;
  }
);
