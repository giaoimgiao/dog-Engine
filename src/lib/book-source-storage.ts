/**
 * 书源存储管理 - 纯净版本，不依赖cheerio等解析库
 * 专门用于书源的读取和保存
 */

import type { BookSource } from './types';
import fs from 'fs/promises';
import path from 'path';

const isVercel = !!process.env.VERCEL;
const dataFilePath = isVercel
    ? path.join('/tmp', 'book_sources.json')
    : path.join(process.cwd(), 'book_sources.json');

/**
 * 获取所有书源
 */
export async function getBookSources(): Promise<BookSource[]> {
  try {
    console.log(`[book-source-storage] 📖 读取书源文件: ${dataFilePath}`);
    const data = await fs.readFile(dataFilePath, 'utf-8');
    const sources = (JSON.parse(data) as BookSource[]).filter(s => s.name && s.url);
    console.log(`[book-source-storage] ✅ 成功读取 ${sources.length} 个书源`);
    return sources;
  } catch (error: any) {
    if (error.code === 'ENOENT') {
      console.log('[book-source-storage] ⚠️ 书源文件不存在，尝试初始化...');
      try {
        const initialDataPath = path.join(process.cwd(), 'book_sources.json');
        const initialData = await fs.readFile(initialDataPath, 'utf-8');
        await fs.writeFile(dataFilePath, initialData, 'utf-8');
        const sources = (JSON.parse(initialData) as BookSource[]).filter(s => s.name && s.url);
        console.log(`[book-source-storage] ✅ 从初始文件加载了 ${sources.length} 个书源`);
        return sources;
      } catch (readError) {
        console.log('[book-source-storage] ⚠️ 初始文件也不存在，创建空文件');
        await fs.writeFile(dataFilePath, '[]', 'utf-8');
        return [];
      }
    }
    console.error("[book-source-storage] ❌ 读取书源时出错:", error);
    return [];
  }
}

/**
 * 保存书源列表
 */
export async function saveBookSources(sources: BookSource[]): Promise<boolean> {
  try {
    console.log(`[book-source-storage] 💾 保存 ${sources.length} 个书源到: ${dataFilePath}`);
    await fs.writeFile(dataFilePath, JSON.stringify(sources, null, 2), 'utf-8');
    console.log('[book-source-storage] ✅ 书源保存成功');
    return true;
  } catch (error: any) {
    console.error('[book-source-storage] ❌ 保存书源失败:', error);
    return false;
  }
}

