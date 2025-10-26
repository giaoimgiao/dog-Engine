import { config } from 'dotenv';
config();

import '@/ai/flows/respond-to-prompt-in-role.ts';
import '@/ai/flows/generate-story-chapter.ts';
import '@/ai/flows/refine-chapter-with-world-info.ts';
import '@/ai/flows/list-models.ts';
import '@/ai/flows/review-manuscript.ts';
