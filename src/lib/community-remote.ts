'use client';

import type { CommunityPrompt } from '@/lib/types';

const BASE_KEY = 'community-api-base';
const TOKEN_KEY = 'community-api-token';

export function getCommunityBase(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem(BASE_KEY);
}

export function setCommunityBase(base: string) {
  if (typeof window === 'undefined') return;
  localStorage.setItem(BASE_KEY, base.replace(/\/$/, ''));
}

export function getCommunityToken(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem(TOKEN_KEY);
}

export function setCommunityToken(token: string) {
  if (typeof window === 'undefined') return;
  localStorage.setItem(TOKEN_KEY, token);
}

export function clearCommunityToken() {
  if (typeof window === 'undefined') return;
  localStorage.removeItem(TOKEN_KEY);
}

function getHeaders() {
  const token = getCommunityToken();
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;
  return headers;
}

export async function communityRegister(params: { username: string; password: string; base?: string }): Promise<{ success: boolean; message?: string }> {
  const base = params.base || getCommunityBase();
  if (!base) return { success: false, message: '未配置服务器地址' };
  try {
    const res = await fetch(`${base}/api/community/auth/register`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ username: params.username, password: params.password })
    });
    if (!res.ok) return { success: false, message: await safeText(res) };
    return { success: true };
  } catch (e: any) {
    return { success: false, message: String(e?.message || e) };
  }
}

export async function communityLogin(params: { username: string; password: string; base?: string }): Promise<{ success: boolean; token?: string; message?: string }> {
  const base = params.base || getCommunityBase();
  if (!base) return { success: false, message: '未配置服务器地址' };
  try {
    const res = await fetch(`${base}/api/community/auth/login`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ username: params.username, password: params.password })
    });
    if (!res.ok) return { success: false, message: await safeText(res) };
    const data = await res.json();
    if (data?.token) setCommunityToken(data.token);
    return { success: true, token: data?.token };
  } catch (e: any) {
    return { success: false, message: String(e?.message || e) };
  }
}

export async function getRemoteVisiblePrompts(base?: string): Promise<CommunityPrompt[]> {
  const urlBase = base || getCommunityBase();
  if (!urlBase) return [];
  const res = await fetch(`/api/community/forward`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ path: '/api/community/prompts/visible', method: 'GET', headers: getHeaders() }) });
  if (!res.ok) throw new Error(await safeText(res));
  const data = await res.json();
  return data?.prompts || [];
}

export async function addRemotePrompt(payload: { name: string; prompt: string; visible: boolean }, base?: string): Promise<{ success: boolean; message?: string }> {
  const urlBase = base || getCommunityBase();
  if (!urlBase) return { success: false, message: '未配置服务器地址' };
  const res = await fetch(`/api/community/forward`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ path: '/api/community/prompts', method: 'POST', headers: getHeaders(), payload }) });
  if (!res.ok) return { success: false, message: await safeText(res) };
  return { success: true };
}

export async function likeRemotePrompt(id: string, base?: string): Promise<{ success: boolean; newLikes?: number; message?: string }> {
  const urlBase = base || getCommunityBase();
  if (!urlBase) return { success: false, message: '未配置服务器地址' };
  const res = await fetch(`/api/community/forward`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ path: `/api/community/prompts/${id}/like`, method: 'POST', headers: getHeaders() }) });
  if (!res.ok) return { success: false, message: await safeText(res) };
  const data = await res.json();
  return { success: true, newLikes: data?.likes };
}

export async function getRemoteAnnouncements(): Promise<{ id: string; message: string; createdAt: string }[]> {
  const res = await fetch(`/api/community/forward`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ path: '/api/community/announcements', method: 'GET' }) });
  if (!res.ok) return [];
  const data = await res.json();
  return data?.announcements || [];
}

export async function postRemoteAnnouncement(message: string): Promise<boolean> {
  const token = getCommunityToken();
  if (!token) return false;
  const res = await fetch(`/api/community/forward`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ path: '/api/community/announcements', method: 'POST', headers: { Authorization: `Bearer ${token}` }, payload: { message } }) });
  return res.ok;
}

export async function updateRemotePrompt(id: string, payload: { name?: string; prompt?: string; visible?: boolean }): Promise<boolean> {
  const token = getCommunityToken();
  if (!token) return false;
  const res = await fetch(`/api/community/forward`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ path: `/api/community/prompts/${id}`, method: 'PUT', headers: { Authorization: `Bearer ${token}` }, payload }) });
  return res.ok;
}

export async function deleteRemotePrompt(id: string): Promise<boolean> {
  const token = getCommunityToken();
  if (!token) return false;
  const res = await fetch(`/api/community/forward`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ path: `/api/community/prompts/${id}`, method: 'DELETE', headers: { Authorization: `Bearer ${token}` } }) });
  return res.ok;
}

async function safeText(res: Response) {
  try { return await res.text(); } catch { return `${res.status}`; }
}


