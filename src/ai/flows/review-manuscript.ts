'use server';

/**
 * @fileOverview An AI agent that reviews a web novel manuscript.
 *
 * - reviewManuscript - A function that handles the manuscript review process.
 * - ReviewManuscriptInput - The input type for the reviewManuscript function.
 * - ReviewManuscriptOutput - The return type for the reviewManuscript function.
 */

import { ai } from '@/ai/genkit';
import { z } from 'genkit';

const ReviewManuscriptInputSchema = z.object({
  manuscript: z.string().max(10000).describe('The manuscript content to be reviewed, with a maximum of 10,000 characters.'),
  modelId: z.string().optional().describe('Optional model ID to use when reviewing.'),
});
export type ReviewManuscriptInput = z.infer<typeof ReviewManuscriptInputSchema>;

const ReviewDecisionSchema = z.enum(['过稿', '拒稿']).describe('The review decision, either "过稿" (Pass) or "拒稿" (Reject).');
type ReviewDecision = z.infer<typeof ReviewDecisionSchema>;

const ReviewManuscriptOutputSchema = z.object({
  decision: ReviewDecisionSchema,
  reason: z.string().describe('The detailed reason for the decision. If it passes, list the strengths. If it is rejected, list the weaknesses.'),
});
export type ReviewManuscriptOutput = z.infer<typeof ReviewManuscriptOutputSchema>;

export async function reviewManuscript(input: ReviewManuscriptInput): Promise<ReviewManuscriptOutput> {
  return reviewManuscriptFlow(input);
}

const reviewPrompt = ai.definePrompt({
  name: 'reviewManuscriptPrompt',
  input: { schema: ReviewManuscriptInputSchema },
  output: { schema: ReviewManuscriptOutputSchema },
  prompt: `你是一个专业的网文编辑，在你的眼中，只有过稿和拒稿。要遵从网文的核心思想“做减法”剔除无效剧情，剧情编排上懂得起承转合，懂热门卖点，你需要来判断新人给的这个开头是否能够签约过稿？

你的审稿标准：
- 拒稿: 拒稿时，不要有任何夸奖或客套话。直接、尖锐地指出问题所在，给出明确的修改方向。
- 过稿: 过稿时，不要提及任何缺点。只说优点，清晰地列出这本书的卖点和吸引人的地方。

现在，请审阅以下稿件：

---
{{{manuscript}}}
---

根据你的判断，给出“过稿”或“拒稿”的结论，并提供详细的理由。`,
});

const reviewManuscriptFlow = ai.defineFlow(
  {
    name: 'reviewManuscriptFlow',
    inputSchema: ReviewManuscriptInputSchema,
    outputSchema: ReviewManuscriptOutputSchema,
  },
  async (input) => {
    const model = input.modelId && input.modelId.trim().length > 0
      ? `googleai/${input.modelId}`
      : 'googleai/gemini-2.5-flash';
    const { output } = await reviewPrompt({ manuscript: input.manuscript }, {
        model,
        config: {
            temperature: 0.2,
        }
    });
    return output!;
  }
);
