export type QueueController = {
  pause: () => void;
  resume: () => void;
  cancel: () => void;
  whenIdle: Promise<void>;
};

export type QueueOptions = {
  concurrency?: number;
  signal?: AbortSignal;
};

export const DEFAULT_CONCURRENCY = 6;

export function runQueue<T>(
  items: readonly T[],
  worker: (item: T, index: number, signal: AbortSignal) => Promise<void>,
  options: QueueOptions = {},
): QueueController {
  const concurrency = Math.max(1, options.concurrency ?? DEFAULT_CONCURRENCY);
  const internal = new AbortController();
  if (options.signal) {
    if (options.signal.aborted) internal.abort();
    options.signal.addEventListener("abort", () => internal.abort());
  }

  let cursor = 0;
  let active = 0;
  let paused = false;
  let resolveIdle!: () => void;
  const whenIdle = new Promise<void>((resolve) => {
    resolveIdle = resolve;
  });

  function next(): void {
    if (internal.signal.aborted) {
      if (active === 0) resolveIdle();
      return;
    }
    if (cursor >= items.length && active === 0) {
      resolveIdle();
      return;
    }
    while (!paused && active < concurrency && cursor < items.length) {
      const index = cursor++;
      const item = items[index]!;
      active++;
      void Promise.resolve()
        .then(() => worker(item, index, internal.signal))
        .catch(() => {
          // worker is responsible for capturing per-item errors; we never bubble.
        })
        .finally(() => {
          active--;
          next();
        });
    }
  }

  // Kick off on next tick so the caller can wire up state before the first run.
  Promise.resolve().then(next);

  return {
    pause: () => {
      paused = true;
    },
    resume: () => {
      if (paused) {
        paused = false;
        next();
      }
    },
    cancel: () => {
      internal.abort();
    },
    whenIdle,
  };
}

export function estimateEtaMs(
  doneCount: number,
  totalCount: number,
  elapsedMs: number,
): number | null {
  if (doneCount <= 0 || totalCount <= doneCount) return totalCount <= doneCount ? 0 : null;
  const perItem = elapsedMs / doneCount;
  return Math.round(perItem * (totalCount - doneCount));
}

export function formatEta(ms: number | null): string {
  if (ms === null) return "—";
  if (ms <= 0) return "0s";
  const totalSec = Math.round(ms / 1000);
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  if (m === 0) return `${s}s`;
  return `${m}m ${s}s`;
}
