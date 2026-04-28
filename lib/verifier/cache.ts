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
