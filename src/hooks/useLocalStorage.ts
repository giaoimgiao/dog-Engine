"use client";

import { useState, useEffect, useRef } from 'react';
import { idbGet, idbSet, requestPersistentStorage } from '@/lib/idb-storage';

// Backward compatible: keep signature, swap backend to IndexedDB with localStorage fallback
export function useLocalStorage<T>(key: string, initialValue: T): [T, (value: T | ((val: T) => T)) => void] {
  // 立即尝试同步读取 localStorage（保证首屏/创建流程不空）
  const [storedValue, setStoredValue] = useState<T>(() => {
    if (typeof window === 'undefined') return initialValue;
    try {
      const raw = window.localStorage.getItem(key);
      return raw ? (JSON.parse(raw) as T) : initialValue;
    } catch {
      return initialValue;
    }
  });
  const mountInitialRef = useRef<T>(storedValue);

  // Initial read from IDB (or fallback)
  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        let v = (await idbGet<T>(key)) as T | undefined;
        if (v === undefined && typeof window !== 'undefined') {
          // 迁移：从旧的 localStorage 读取一次并写入IDB
          try {
            const legacy = window.localStorage.getItem(key);
            if (legacy) {
              const parsed = JSON.parse(legacy) as T;
              await idbSet<T>(key, parsed);
              v = parsed;
            }
          } catch {}
        }
        // 只有在挂载后值未被用户更改过时，才用IDB覆盖，避免闪回
        if (mounted && v !== undefined) {
          if (storedValue === mountInitialRef.current) {
            setStoredValue(v);
          }
        }
        requestPersistentStorage().catch(() => {});
      } catch {
        // ignore
      }
    })();
    return () => { mounted = false; };
  }, [key]);

  // Persist on change
  useEffect(() => {
    (async () => {
      try { await idbSet<T>(key, storedValue); } catch {}
      try { if (typeof window !== 'undefined') window.localStorage.setItem(key, JSON.stringify(storedValue)); } catch {}
    })();
  }, [key, storedValue]);

  const setValue = (value: T | ((val: T) => T)) => {
    setStoredValue(value);
  };

  return [storedValue, setValue];
}
