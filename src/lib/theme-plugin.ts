'use client';

import { idbGet, idbSet } from '@/lib/idb-storage';

export interface ThemePluginManifest {
  id: string;
  name: string;
  version: string;
  apiVersion: string; // e.g. "0.1"
  permissions?: Array<'theme'>;
  theme: {
    tokens: Record<string, string>;
  };
  author?: string;
  description?: string;
  homepage?: string;
  /**
   * Scoped token overrides per UI 区域。
   * 例如：topbar / sidebar / editor / actionbar
   */
  scopes?: Record<string, Record<string, string>>;
}

export const THEME_PLUGINS_KEY = 'theme.plugins.v1';
export const THEME_SELECTED_ID_KEY = 'theme.selected.id.v1';

// Whitelisted token keys that plugins can set
export const THEME_TOKEN_KEYS: string[] = [
  '--editor-bg',
  '--editor-fg',
  '--editor-accent',
  '--editor-font-family',
  '--editor-font-size',
  '--editor-line-height',
  '--editor-paragraph-spacing',
  '--editor-padding',
  '--editor-caret-color',
  '--editor-selection-bg',
  '--editor-selection-fg',
  // shadcn design tokens (可作用于局部容器以定制不同区域)
  '--background',
  '--foreground',
  '--card',
  '--card-foreground',
  '--popover',
  '--popover-foreground',
  '--primary',
  '--primary-foreground',
  '--secondary',
  '--secondary-foreground',
  '--muted',
  '--muted-foreground',
  '--accent',
  '--accent-foreground',
  '--destructive',
  '--destructive-foreground',
  '--border',
  '--input',
  '--ring',
];

// 可用的作用域名称
export const THEME_SCOPES = ['root', 'topbar', 'sidebar', 'editor', 'actionbar'] as const;
export type ThemeScope = typeof THEME_SCOPES[number];

export function validateThemePlugin(manifest: any): ThemePluginManifest {
  if (!manifest || typeof manifest !== 'object') throw new Error('Invalid manifest');
  const required = ['id', 'name', 'version', 'apiVersion', 'theme'];
  for (const k of required) {
    if (!(k in manifest)) throw new Error(`Manifest missing field: ${k}`);
  }
  if (!manifest.theme || typeof manifest.theme.tokens !== 'object') {
    throw new Error('Manifest.theme.tokens must be an object');
  }
  // Filter tokens to whitelist only
  const filtered: Record<string, string> = {};
  for (const [key, value] of Object.entries<string>(manifest.theme.tokens || {} as any)) {
    if (THEME_TOKEN_KEYS.includes(key) && typeof value === 'string') {
      filtered[key] = value;
    }
  }
  // scopes 过滤
  const scopeObj: Record<string, Record<string, string>> = {};
  if (manifest.scopes && typeof manifest.scopes === 'object') {
    for (const [scopeName, tokens] of Object.entries<any>(manifest.scopes)) {
      if (!tokens || typeof tokens !== 'object') continue;
      const filteredScope: Record<string, string> = {};
      for (const [k, v] of Object.entries(tokens)) {
        if (THEME_TOKEN_KEYS.includes(k) && typeof v === 'string') filteredScope[k] = v;
      }
      scopeObj[scopeName] = filteredScope;
    }
  }

  return {
    id: String(manifest.id),
    name: String(manifest.name),
    version: String(manifest.version),
    apiVersion: String(manifest.apiVersion),
    permissions: Array.isArray(manifest.permissions) ? (manifest.permissions as Array<'theme'>).filter(p => p === 'theme') : ['theme'],
    theme: { tokens: filtered },
    author: manifest.author ? String(manifest.author) : undefined,
    description: manifest.description ? String(manifest.description) : undefined,
    homepage: manifest.homepage ? String(manifest.homepage) : undefined,
    scopes: scopeObj,
  };
}

export function applyThemeTokensToElement(el: HTMLElement, tokens: Record<string, string> | undefined | null): () => void {
  if (!el) return () => {};
  const prev: Record<string, string> = {};
  const prevRoot: Record<string, string> = {};
  
  for (const key of THEME_TOKEN_KEYS) {
    prev[key] = el.style.getPropertyValue(key);
    if (typeof document !== 'undefined') {
      prevRoot[key] = document.documentElement.style.getPropertyValue(key);
    }
  }
  
  if (tokens) {
    for (const [k, v] of Object.entries(tokens)) {
      if (THEME_TOKEN_KEYS.includes(k)) {
        el.style.setProperty(k, v);
        // 同时应用到 :root，确保全局生效（Tailwind bg-background 等类读取 :root）
        if (typeof document !== 'undefined') {
          document.documentElement.style.setProperty(k, v);
        }
      }
    }
  } else {
    // tokens 为 null 时，清除所有变量（恢复默认）
    for (const key of THEME_TOKEN_KEYS) {
      el.style.removeProperty(key);
      if (typeof document !== 'undefined') {
        document.documentElement.style.removeProperty(key);
      }
    }
  }
  
  return () => {
    for (const key of THEME_TOKEN_KEYS) {
      if (prev[key]) el.style.setProperty(key, prev[key]); else el.style.removeProperty(key);
      if (typeof document !== 'undefined') {
        if (prevRoot[key]) {
          document.documentElement.style.setProperty(key, prevRoot[key]);
        } else {
          document.documentElement.style.removeProperty(key);
        }
      }
    }
  };
}

export function mergeThemeTokens(baseTokens: Record<string, string>, overrideTokens?: Record<string, string> | null): Record<string, string> {
  return { ...baseTokens, ...(overrideTokens || {}) };
}

export function getTokensForScope(manifest: ThemePluginManifest | null | undefined, scope: ThemeScope): Record<string, string> | null {
  if (!manifest) return null;
  const base = manifest.theme?.tokens || {};
  const scoped = manifest.scopes?.[scope] || {};
  return { ...base, ...scoped };
}

export async function loadInstalledThemes(): Promise<ThemePluginManifest[]> {
  const list = await idbGet<ThemePluginManifest[]>(THEME_PLUGINS_KEY);
  return Array.isArray(list) ? list : [];
}

export async function saveInstalledThemes(themes: ThemePluginManifest[]): Promise<void> {
  await idbSet(THEME_PLUGINS_KEY, themes);
}

export async function loadSelectedThemeId(): Promise<string | null> {
  const id = await idbGet<string | null>(THEME_SELECTED_ID_KEY);
  return id ?? null;
}

export async function saveSelectedThemeId(id: string | null): Promise<void> {
  await idbSet(THEME_SELECTED_ID_KEY, id);
}


