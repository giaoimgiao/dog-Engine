'use client';

// A tiny IndexedDB key-value helper with graceful fallback to localStorage.
// Store: one object store named 'kv', records as { key: string, value: any }

const DB_NAME = 'dog_engine_db';
const STORE_NAME = 'kv';
const DB_VERSION = 1;

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      reject(new Error('IndexedDB not available'));
      return;
    }
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'key' });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error || new Error('openDB failed'));
  });
}

async function withStore<T>(mode: IDBTransactionMode, fn: (store: IDBObjectStore) => Promise<T>): Promise<T> {
  const db = await openDB();
  return new Promise<T>((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, mode);
    const store = tx.objectStore(STORE_NAME);
    fn(store).then(
      (res) => resolve(res),
      (err) => reject(err)
    );
    tx.oncomplete = () => db.close();
    tx.onerror = () => reject(tx.error || new Error('transaction error'));
    tx.onabort = () => reject(tx.error || new Error('transaction abort'));
  });
}

export async function idbGet<T>(key: string): Promise<T | undefined> {
  try {
    return await withStore('readonly', (store) => new Promise<T | undefined>((resolve, reject) => {
      const req = store.get(key);
      req.onsuccess = () => resolve(req.result ? (req.result as any).value as T : undefined);
      req.onerror = () => reject(req.error || new Error('get error'));
    }));
  } catch {
    try {
      if (typeof localStorage !== 'undefined') {
        const raw = localStorage.getItem(key);
        return raw ? (JSON.parse(raw) as T) : undefined;
      }
    } catch {}
    return undefined;
  }
}

export async function idbSet<T>(key: string, value: T): Promise<void> {
  try {
    await withStore('readwrite', (store) => new Promise<void>((resolve, reject) => {
      const req = store.put({ key, value });
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error || new Error('put error'));
    }));
  } catch {
    try {
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem(key, JSON.stringify(value));
      }
    } catch {}
  }
}

export async function idbGetAllKeys(): Promise<string[]> {
  try {
    return await withStore('readonly', (store) => new Promise<string[]>((resolve, reject) => {
      // modern browsers support getAllKeys
      // but ensure fallback cursor
      const keys: string[] = [];
      if ('getAllKeys' in store) {
        const req = (store as any).getAllKeys();
        req.onsuccess = () => resolve(req.result as string[]);
        req.onerror = () => reject(req.error || new Error('getAllKeys error'));
      } else {
        const req = store.openCursor();
        req.onsuccess = () => {
          const cursor = req.result as IDBCursorWithValue | null;
          if (cursor) {
            keys.push(String(cursor.key));
            cursor.continue();
          } else {
            resolve(keys);
          }
        };
        req.onerror = () => reject(req.error || new Error('cursor error'));
      }
    }));
  } catch {
    try {
      if (typeof localStorage !== 'undefined') {
        return Object.keys(localStorage);
      }
    } catch {}
    return [];
  }
}

export async function requestPersistentStorage(): Promise<boolean> {
  try {
    // Request site to be marked as persistent to reduce eviction
    if (navigator?.storage && 'persist' in navigator.storage) {
      // @ts-ignore
      const granted = await navigator.storage.persist();
      return !!granted;
    }
  } catch {}
  return false;
}

export async function exportAllToJSON(): Promise<string> {
  const keys = await idbGetAllKeys();
  const entries: Record<string, any> = {};
  for (const k of keys) {
    const v = await idbGet<any>(k);
    if (v !== undefined) entries[k] = v;
  }
  return JSON.stringify({ version: 1, data: entries }, null, 2);
}

export async function importFromJSON(json: string): Promise<number> {
  const parsed = JSON.parse(json);
  const data = parsed?.data || {};
  const keys = Object.keys(data);
  for (const k of keys) {
    await idbSet(k, data[k]);
  }
  return keys.length;
}


