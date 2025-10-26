'use server';
/**
 * @fileOverview An AI agent that responds to prompts in a specified role, incorporating context from various sources.
 *
 * - respondToPromptInRole - A function that handles the AI response generation process.
 * - RespondToPromptInRoleInput - The input type for the respondToPromptInRole function.
 * - RespondToPromptInRoleOutput - The return type for the respondToPrmptInRole function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const RespondToPromptInRoleInputSchema = z.object({
  prompt: z.string().describe('The user-provided prompt for the AI to respond to.'),
  aiRole: z.string().describe('The role the AI should adopt when responding.'),
  chapterContext: z.string().optional().describe('The entire content of the editor, treated as conversation history or the main body of the story.'),
  characterCardContext: z.string().optional().describe('Context from enabled character cards.'),
  worldBookKeywordsContext: z.string().optional().describe('Context from world book keywords.'),
  model: z.string().optional().describe('The model to use for the response.'),
  temperature: z.number().optional().describe('The temperature for the model.'),
  maxOutputTokens: z.number().optional().describe('The maximum number of tokens to generate.'),
  includeThoughts: z.boolean().optional().describe('Whether to include the AI\'s thought process in the output.'),
  thinkingBudget: z.number().optional().describe('The token budget for the AI\'s thinking process. -1 for dynamic.'),
});
export type RespondToPromptInRoleInput = z.infer<typeof RespondToPromptInRoleInputSchema>;

// The output is now just a plain string, not a JSON object.
export type RespondToPromptInRoleOutput = string;

export async function respondToPromptInRole(input: RespondToPromptInRoleInput): Promise<RespondToPromptInRoleOutput> {
  return respondToPromptInRoleFlow(input);
}

// A new, structured prompt that presents context clearly to the AI.
const promptTemplate = ai.definePrompt({
  name: 'respondToPromptInRolePrompt',
  input: {schema: RespondToPromptInRoleInputSchema},
  prompt: `{{#if aiRole}}
# Your Role and Settings
You will adopt the following role:
{{aiRole}}
{{/if}}

{{#if characterCardContext}}
# Characters in the Story
Here is information about the characters who should appear in this creation:
---
{{characterCardContext}}
---
{{/if}}

{{#if worldBookKeywordsContext}}
# Relevant World-Building Settings
Please refer to the following world-building settings during your creation:
---
{{worldBookKeywordsContext}}
---
{{/if}}

# Story Content
The following is the story content that has already been created (this is your conversation history):
---
{{{chapterContext}}}
---

# Your Task
Now, please strictly follow the instructions below and continue creating based on the story content. Directly output the subsequent storyline. Do not repeat or summarize any instructions or background information you have received.

Instruction: {{{prompt}}}
`,
});

const respondToPromptInRoleFlow = ai.defineFlow(
  {
    name: 'respondToPromptInRoleFlow',
    inputSchema: RespondToPromptInRoleInputSchema,
    outputSchema: z.string(),
  },
  async input => {
    const { model, temperature, maxOutputTokens, includeThoughts, thinkingBudget, ...promptData } = input;
    
    const config: any = {
        temperature,
        maxOutputTokens,
        safetySettings: [
            { category: 'HARM_CATEGORY_HATE_SPEECH', threshold: 'BLOCK_NONE' },
            { category: 'HARM_CATEGORY_DANGEROUS_CONTENT', threshold: 'BLOCK_NONE' },
            { category: 'HARM_CATEGORY_HARASSMENT', threshold: 'BLOCK_NONE' },
            { category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT', threshold: 'BLOCK_NONE' },
        ],
    };

    if (includeThoughts) {
        config.thinkingConfig = {
            includeThoughts: true,
            thinkingBudget: thinkingBudget === -1 ? undefined : thinkingBudget,
        };
    }
    
    const response = await promptTemplate(promptData, {
      model: model ? (model as any) : 'googleai/gemini-2.5-flash',
      config,
    });
    
    // The `response.text` will contain the full output, including thoughts if enabled.
    // This is the simplest and most robust way to get the content.
    return response.text;
  }
);
