import type { Book, Chapter, Character, WorldSetting } from './types';
import { generateUUID } from './utils';

/**
 * 保存章节内容到本地文件系统（浏览器下载）
 */
export async function saveChapterToFile(chapter: Chapter, bookTitle: string) {
  const content = formatChapterContent(chapter, bookTitle);
  const fileName = `${sanitizeFileName(bookTitle)}_${sanitizeFileName(chapter.title)}.txt`;
  
  downloadTextFile(content, fileName);
}

/**
 * 保存整本书到本地文件系统
 */
export async function saveBookToFile(book: Book) {
  const content = formatBookContent(book);
  const fileName = `${sanitizeFileName(book.title)}_完整版.txt`;
  
  downloadTextFile(content, fileName);
}

// ===== 角色卡 / 世界书 导入导出 =====

export type CharacterExportPayload = {
  type: 'character-cards';
  version: 1;
  items: Array<Pick<Character, 'name' | 'description' | 'enabled' | 'linkedBookIds'>>;
};

export type WorldBookExportPayload = {
  type: 'worldbook';
  version: 1;
  items: Array<Pick<WorldSetting, 'keyword' | 'description' | 'enabled' | 'linkedBookIds'>>;
};

export function exportCharactersToJson(characters: Character[]): string {
  const payload: CharacterExportPayload = {
    type: 'character-cards',
    version: 1,
    items: characters.map(c => ({ name: c.name, description: c.description, enabled: !!c.enabled, linkedBookIds: c.linkedBookIds || [] })),
  };
  return JSON.stringify(payload, null, 2);
}

export function exportWorldbookToJson(settings: WorldSetting[]): string {
  const payload: WorldBookExportPayload = {
    type: 'worldbook',
    version: 1,
    items: settings.map(s => ({ keyword: s.keyword, description: s.description, enabled: !!s.enabled, linkedBookIds: s.linkedBookIds || [] })),
  };
  return JSON.stringify(payload, null, 2);
}

export function importCharactersFromJson(json: string): Character[] {
  try {
    const data = JSON.parse(json);
    if (data?.type !== 'character-cards') return [];
    const items = Array.isArray(data.items) ? data.items : [];
    return items.map((it: any) => ({
      id: generateUUID(),
      name: String(it?.name || ''),
      description: String(it?.description || ''),
      enabled: Boolean(it?.enabled),
      linkedBookIds: Array.isArray(it?.linkedBookIds) ? it.linkedBookIds : [],
    }));
  } catch {
    return [];
  }
}

export function importWorldbookFromJson(json: string): WorldSetting[] {
  try {
    const data = JSON.parse(json);
    if (data?.type !== 'worldbook') return [];
    const items = Array.isArray(data.items) ? data.items : [];
    return items.map((it: any) => ({
      id: generateUUID(),
      keyword: String(it?.keyword || ''),
      description: String(it?.description || ''),
      enabled: Boolean(it?.enabled),
      linkedBookIds: Array.isArray(it?.linkedBookIds) ? it.linkedBookIds : [],
    }));
  } catch {
    return [];
  }
}

/**
 * 复制章节内容到剪贴板
 */
export async function copyChapterToClipboard(chapter: Chapter, bookTitle: string): Promise<boolean> {
  const content = formatChapterContent(chapter, bookTitle);
  return copyToClipboard(content);
}

/**
 * 复制整本书到剪贴板
 */
export async function copyBookToClipboard(book: Book): Promise<boolean> {
  const content = formatBookContent(book);
  return copyToClipboard(content);
}

/**
 * 格式化单章内容为文本
 */
function formatChapterContent(chapter: Chapter, bookTitle: string): string {
  const lines: string[] = [];
  
  lines.push('='.repeat(50));
  lines.push(`书名：${bookTitle}`);
  lines.push(`章节：${chapter.title}`);
  lines.push(`字数：${chapter.content.replace(/\s+/g, '').length}`);
  lines.push('='.repeat(50));
  lines.push('');
  lines.push(chapter.content);
  lines.push('');
  lines.push('='.repeat(50));
  
  return lines.join('\n');
}

/**
 * 格式化整本书为文本
 */
function formatBookContent(book: Book): string {
  const lines: string[] = [];
  
  // 书籍信息
  lines.push('='.repeat(60));
  lines.push(`《${book.title}》`);
  lines.push('='.repeat(60));
  lines.push('');
  
  if (book.description) {
    lines.push('【简介】');
    lines.push(book.description);
    lines.push('');
  }
  
  const totalWords = book.chapters.reduce((sum, ch) => sum + ch.content.replace(/\s+/g, '').length, 0);
  lines.push(`【统计信息】`);
  lines.push(`章节数：${book.chapters.length}`);
  lines.push(`总字数：${totalWords}`);
  lines.push('');
  lines.push('='.repeat(60));
  lines.push('');
  
  // 章节内容
  book.chapters.forEach((chapter, index) => {
    lines.push('');
    lines.push(`第${index + 1}章：${chapter.title}`);
    lines.push('-'.repeat(50));
    lines.push('');
    lines.push(chapter.content);
    lines.push('');
  });
  
  return lines.join('\n');
}

/**
 * 下载文本文件
 */
function downloadTextFile(content: string, fileName: string) {
  const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/**
 * 复制文本到剪贴板
 */
async function copyToClipboard(text: string): Promise<boolean> {
  try {
    // 优先使用现代 Clipboard API
    if (navigator.clipboard && navigator.clipboard.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    } else {
      // 降级方案：使用传统方法
      const textArea = document.createElement('textarea');
      textArea.value = text;
      textArea.style.position = 'fixed';
      textArea.style.left = '-999999px';
      textArea.style.top = '-999999px';
      document.body.appendChild(textArea);
      textArea.focus();
      textArea.select();
      
      try {
        document.execCommand('copy');
        document.body.removeChild(textArea);
        return true;
      } catch (err) {
        document.body.removeChild(textArea);
        return false;
      }
    }
  } catch (error) {
    console.error('Copy failed:', error);
    return false;
  }
}

/**
 * 清理文件名，移除非法字符
 */
function sanitizeFileName(fileName: string): string {
  return fileName
    .replace(/[<>:"/\\|?*\x00-\x1f]/g, '_') // 替换非法字符
    .replace(/\s+/g, '_') // 空格替换为下划线
    .replace(/_{2,}/g, '_') // 多个下划线合并为一个
    .substring(0, 100); // 限制长度
}

