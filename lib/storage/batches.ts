"use client";

import type { BatchRow } from "@/lib/schema/batch";

const DB_NAME = "label-verifier";
const VERSION = 2;
const BATCHES_STORE = "batches";
const ROWS_STORE = "batch-rows";

export type StoredBatch = {
  id: string;
  createdAt: number;
  total: number;
  // Persistable: only the application + filename + state + result. Files cannot survive a reload.
};

const memoryBatches = new Map<string, StoredBatch>();
const memoryRows = new Map<string, BatchRow[]>();

let openPromise: Promise<IDBDatabase | null> | null = null;
let warned = false;
let onMemoryFallback: ((reason: string) => void) | null = null;

export function setMemoryFallbackHandler(fn: (reason: string) => void): void {
  onMemoryFallback = fn;
}

function notifyFallback(reason: string): void {
  if (warned) return;
  warned = true;
  onMemoryFallback?.(reason);
}

function open(): Promise<IDBDatabase | null> {
  if (openPromise) return openPromise;
  if (typeof indexedDB === "undefined") {
    notifyFallback("IndexedDB is unavailable in this browser");
    openPromise = Promise.resolve(null);
    return openPromise;
  }
  openPromise = new Promise((resolve) => {
    let req: IDBOpenDBRequest;
    try {
      req = indexedDB.open(DB_NAME, VERSION);
    } catch (err) {
      notifyFallback(err instanceof Error ? err.message : "Could not open browser storage");
      resolve(null);
      return;
    }
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(BATCHES_STORE)) {
        db.createObjectStore(BATCHES_STORE, { keyPath: "id" });
      }
      if (!db.objectStoreNames.contains(ROWS_STORE)) {
        const store = db.createObjectStore(ROWS_STORE, { keyPath: "key" });
        store.createIndex("batchId", "batchId", { unique: false });
      }
      if (!db.objectStoreNames.contains("explanations")) {
        db.createObjectStore("explanations");
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => {
      notifyFallback("Couldn't open browser storage — history won't persist this session");
      resolve(null);
    };
    req.onblocked = () => {
      notifyFallback("Another tab is upgrading storage — history won't persist this session");
      resolve(null);
    };
  });
  return openPromise;
}

function rowKey(batchId: string, rowId: string): string {
  return `${batchId}:${rowId}`;
}

type StoredRow = BatchRow & { key: string; batchId: string };

export async function saveBatch(meta: StoredBatch): Promise<void> {
  memoryBatches.set(meta.id, meta);
  const db = await open();
  if (!db) return;
  try {
    const tx = db.transaction(BATCHES_STORE, "readwrite");
    tx.objectStore(BATCHES_STORE).put(meta);
  } catch {
    // mirror lives in memoryBatches
  }
}

export async function saveRow(batchId: string, row: BatchRow): Promise<void> {
  const list = memoryRows.get(batchId) ?? [];
  const idx = list.findIndex((r) => r.id === row.id);
  if (idx >= 0) list[idx] = row;
  else list.push(row);
  memoryRows.set(batchId, list);

  const db = await open();
  if (!db) return;
  const stored: StoredRow = { ...row, key: rowKey(batchId, row.id), batchId };
  try {
    const tx = db.transaction(ROWS_STORE, "readwrite");
    tx.objectStore(ROWS_STORE).put(stored);
  } catch {
    // memory mirror still has it
  }
}

export async function listBatches(): Promise<StoredBatch[]> {
  const db = await open();
  if (!db) return Array.from(memoryBatches.values());
  return new Promise<StoredBatch[]>((resolve) => {
    try {
      const tx = db.transaction(BATCHES_STORE, "readonly");
      const req = tx.objectStore(BATCHES_STORE).getAll();
      req.onsuccess = () => resolve((req.result as StoredBatch[]) ?? []);
      req.onerror = () => resolve(Array.from(memoryBatches.values()));
    } catch {
      resolve(Array.from(memoryBatches.values()));
    }
  });
}

export async function loadRows(batchId: string): Promise<BatchRow[]> {
  const cached = memoryRows.get(batchId);
  if (cached) return cached;
  const db = await open();
  if (!db) return [];
  return new Promise<BatchRow[]>((resolve) => {
    try {
      const tx = db.transaction(ROWS_STORE, "readonly");
      const idx = tx.objectStore(ROWS_STORE).index("batchId");
      const req = idx.getAll(IDBKeyRange.only(batchId));
      req.onsuccess = () => {
        const out = (req.result as StoredRow[]).map<BatchRow>((r) => ({
          id: r.id,
          filename: r.filename,
          application: r.application,
          state: r.state,
          result: r.result,
          errorMessage: r.errorMessage,
          startedAt: r.startedAt,
          finishedAt: r.finishedAt,
        }));
        memoryRows.set(batchId, out);
        resolve(out);
      };
      req.onerror = () => resolve([]);
    } catch {
      resolve([]);
    }
  });
}

export async function deleteBatch(batchId: string): Promise<void> {
  memoryBatches.delete(batchId);
  memoryRows.delete(batchId);
  const db = await open();
  if (!db) return;
  try {
    const tx = db.transaction([BATCHES_STORE, ROWS_STORE], "readwrite");
    tx.objectStore(BATCHES_STORE).delete(batchId);
    const idx = tx.objectStore(ROWS_STORE).index("batchId");
    const req = idx.openCursor(IDBKeyRange.only(batchId));
    req.onsuccess = () => {
      const cursor = req.result;
      if (cursor) {
        cursor.delete();
        cursor.continue();
      }
    };
  } catch {
    // memory side already cleared
  }
}
