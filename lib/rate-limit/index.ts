export type RateLimitBucket = "single" | "batch";

type BucketConfig = {
  limit: number;
  windowMs: number;
};

const BUCKETS: Record<RateLimitBucket, BucketConfig> = {
  single: { limit: 30, windowMs: 60_000 },
  batch: { limit: 1, windowMs: 60_000 },
};

export type RateLimitResult =
  | { allowed: true; remaining: number; retryAfterSec: 0 }
  | { allowed: false; remaining: 0; retryAfterSec: number };

const store = new Map<string, number[]>();

function key(bucket: RateLimitBucket, ip: string) {
  return `${bucket}:${ip}`;
}

function prune(timestamps: number[], cutoff: number): number[] {
  let i = 0;
  while (i < timestamps.length && timestamps[i]! < cutoff) i++;
  return i === 0 ? timestamps : timestamps.slice(i);
}

export function checkRateLimit(
  bucket: RateLimitBucket,
  ip: string,
  now = Date.now(),
): RateLimitResult {
  const cfg = BUCKETS[bucket];
  const k = key(bucket, ip);
  const cutoff = now - cfg.windowMs;
  const recent = prune(store.get(k) ?? [], cutoff);

  if (recent.length >= cfg.limit) {
    const oldest = recent[0]!;
    const retryAfterSec = Math.max(1, Math.ceil((oldest + cfg.windowMs - now) / 1000));
    store.set(k, recent);
    return { allowed: false, remaining: 0, retryAfterSec };
  }

  recent.push(now);
  store.set(k, recent);
  return { allowed: true, remaining: cfg.limit - recent.length, retryAfterSec: 0 };
}

export function resetRateLimit(): void {
  store.clear();
}

export function clientIpFromHeaders(headers: Headers): string {
  const fwd = headers.get("x-forwarded-for");
  if (fwd) {
    const first = fwd.split(",")[0]?.trim();
    if (first) return first;
  }
  return headers.get("x-real-ip") ?? "anonymous";
}
