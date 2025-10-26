'use server';

import fs from 'fs/promises';
import path from 'path';
import { randomUUID } from 'crypto';
import type { CommunityPrompt } from '@/lib/types';

const dataFilePath = path.join(process.cwd(), 'src', 'data', 'community-prompts.json');
// 本地存储版社区，无需发布密码

async function readPrompts(): Promise<CommunityPrompt[]> {
  try {
    await fs.access(dataFilePath);
    const data = await fs.readFile(dataFilePath, 'utf-8');
    if (!data) {
        return [];
    }
    return JSON.parse(data) as CommunityPrompt[];
  } catch (error) {
    // If the file doesn't exist, create it with an empty array.
    await writePrompts([]);
    return [];
  }
}

async function writePrompts(prompts: CommunityPrompt[]): Promise<void> {
    const dataDir = path.dirname(dataFilePath);
    try {
        await fs.access(dataDir);
    } catch (error) {
        await fs.mkdir(dataDir, { recursive: true });
    }
    await fs.writeFile(dataFilePath, JSON.stringify(prompts, null, 2), 'utf-8');
}

export async function getPrompts(): Promise<CommunityPrompt[]> {
  const prompts = await readPrompts();
  return prompts
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
}

export async function getVisiblePrompts(): Promise<CommunityPrompt[]> {
    const prompts = await readPrompts();
    return prompts
      .filter(p => p.visible)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
}


export async function addPrompt(data: { name: string; prompt: string; visible: boolean }): Promise<{ success: boolean; message: string }> {

  if (!data.name.trim() || !data.prompt.trim()) {
    return { success: false, message: '角色名和角色设定不能为空。' };
  }

  const prompts = await readPrompts();
  
  const newPrompt: CommunityPrompt = {
    id: randomUUID(),
    name: data.name.trim(),
    prompt: data.prompt.trim(),
    likes: 0,
    visible: data.visible,
    createdAt: new Date().toISOString(),
  };

  prompts.push(newPrompt);
  await writePrompts(prompts);

  return { success: true, message: '发布成功！' };
}

export async function likePrompt(id: string): Promise<{ success: boolean; newLikes?: number }> {
  const prompts = await readPrompts();
  const promptIndex = prompts.findIndex(p => p.id === id);

  if (promptIndex === -1) {
    return { success: false };
  }

  prompts[promptIndex].likes += 1;
  await writePrompts(prompts);

  return { success: true, newLikes: prompts[promptIndex].likes };
}

export async function deletePrompt(id: string): Promise<{ success: boolean }> {
  const prompts = await readPrompts();
  const idx = prompts.findIndex(p => p.id === id);
  if (idx === -1) return { success: false };
  prompts.splice(idx, 1);
  await writePrompts(prompts);
  return { success: true };
}

export async function updatePrompt(data: { id: string; name?: string; prompt?: string; visible?: boolean }): Promise<{ success: boolean }> {
  const prompts = await readPrompts();
  const idx = prompts.findIndex(p => p.id === data.id);
  if (idx === -1) return { success: false };
  if (typeof data.name === 'string') prompts[idx].name = data.name;
  if (typeof data.prompt === 'string') prompts[idx].prompt = data.prompt;
  if (typeof data.visible === 'boolean') prompts[idx].visible = data.visible;
  await writePrompts(prompts);
  return { success: true };
}
