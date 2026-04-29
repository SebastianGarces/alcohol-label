import type { VerificationResult } from "@/lib/schema/result";

const MAX_ENTRIES = 32;
const cache = new Map<string, VerificationResult>();

function key(hash: string, applicationKey: string): string {
  return `${hash}::${applicationKey}`;
}

export function get(hash: string, applicationKey: string): VerificationResult | undefined {
  const k = key(hash, applicationKey);
  const hit = cache.get(k);
  if (hit) {
    cache.delete(k);
    cache.set(k, hit);
  }
  return hit;
}

export function set(hash: string, applicationKey: string, value: VerificationResult): void {
  const k = key(hash, applicationKey);
  cache.delete(k);
  cache.set(k, value);
  if (cache.size > MAX_ENTRIES) {
    const oldest = cache.keys().next().value;
    if (oldest) cache.delete(oldest);
  }
}

// Test/eval seam: drop all cached entries. Production code never calls this —
// the cache is process-local and rotates by LRU. The eval harness needs it
// between mode runs so that swapping the model dependency actually re-extracts
// against the live VLMs instead of returning the previous mode's cached result.
export function clear(): void {
  cache.clear();
}
