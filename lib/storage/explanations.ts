"use client";

const DB_NAME = "label-verifier";
const STORE = "explanations";
const VERSION = 1;

const memory = new Map<string, string>();
let dbPromise: Promise<IDBDatabase | null> | null = null;

function open(): Promise<IDBDatabase | null> {
  if (typeof indexedDB === "undefined") return Promise.resolve(null);
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve) => {
    let req: IDBOpenDBRequest;
    try {
      req = indexedDB.open(DB_NAME, VERSION);
    } catch {
      resolve(null);
      return;
    }
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE);
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => resolve(null);
    req.onblocked = () => resolve(null);
  });
  return dbPromise;
}

export async function getExplanation(key: string): Promise<string | null> {
  const cached = memory.get(key);
  if (cached) return cached;
  const db = await open();
  if (!db) return null;
  return new Promise<string | null>((resolve) => {
    try {
      const tx = db.transaction(STORE, "readonly");
      const req = tx.objectStore(STORE).get(key);
      req.onsuccess = () => {
        const v = typeof req.result === "string" ? req.result : null;
        if (v) memory.set(key, v);
        resolve(v);
      };
      req.onerror = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
}

export async function setExplanation(key: string, value: string): Promise<void> {
  memory.set(key, value);
  const db = await open();
  if (!db) return;
  try {
    const tx = db.transaction(STORE, "readwrite");
    tx.objectStore(STORE).put(value, key);
  } catch {
    // ignore — memory cache still holds it for this session
  }
}

export function explanationKey(resultId: string, scope: string): string {
  return `${resultId}:${scope}`;
}
