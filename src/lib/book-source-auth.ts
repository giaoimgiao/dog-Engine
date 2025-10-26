import fs from 'fs/promises';
import path from 'path';

export interface BookSourceAuth {
  sourceId: string;
  cookies?: Record<string, string>; // domain(or base url) -> cookie string
  tokens?: Record<string, string>;  // optional key-value for custom tokens
}

const isVercel = !!process.env.VERCEL;
const dataFilePath = isVercel
  ? path.join('/tmp', 'book_source_auth.json')
  : path.join(process.cwd(), 'book_source_auth.json');

async function readAll(): Promise<BookSourceAuth[]> {
  try {
    const txt = await fs.readFile(dataFilePath, 'utf-8');
    const arr = JSON.parse(txt);
    return Array.isArray(arr) ? arr : [];
  } catch (e: any) {
    if (e.code === 'ENOENT') {
      await fs.writeFile(dataFilePath, '[]', 'utf-8');
      return [];
    }
    return [];
  }
}

async function writeAll(list: BookSourceAuth[]) {
  await fs.writeFile(dataFilePath, JSON.stringify(list, null, 2), 'utf-8');
}

export async function getAuth(sourceId: string): Promise<BookSourceAuth | null> {
  const all = await readAll();
  return all.find(a => a.sourceId === sourceId) || null;
}

export async function saveAuth(auth: BookSourceAuth): Promise<boolean> {
  const all = await readAll();
  const idx = all.findIndex(a => a.sourceId === auth.sourceId);
  if (idx >= 0) all[idx] = auth; else all.push(auth);
  await writeAll(all);
  return true;
}

export async function getCookieForUrl(sourceId: string, targetUrl: string): Promise<string> {
  try {
    const u = new URL(targetUrl);
    const domain = u.origin; // include protocol + host + optional port
    const domainHost = u.host; // host with port
    const all = await readAll();
    const auth = all.find(a => a.sourceId === sourceId);
    if (!auth) return '';
    const foundCookie = (
      auth.cookies?.[domain] ||
      auth.cookies?.[domainHost] ||
      auth.cookies?.[u.hostname] ||
      ''
    );
    const key = auth.tokens?.key;
    if (key && !/qttoken=/.test(foundCookie)) {
      return foundCookie ? `${foundCookie}; qttoken=${key}` : `qttoken=${key}`;
    }
    return foundCookie;
  } catch {
    return '';
  }
}


