import { beforeEach, describe, expect, it } from "vitest";
import { checkRateLimit, resetRateLimit } from "../index";

describe("rate limiter", () => {
  beforeEach(() => {
    resetRateLimit();
  });

  it("allows the first 30 single-verifies and blocks the 31st", () => {
    const ip = "203.0.113.7";
    const t0 = 1_700_000_000_000;
    for (let i = 0; i < 30; i++) {
      const r = checkRateLimit("single", ip, t0 + i);
      expect(r.allowed).toBe(true);
    }
    const blocked = checkRateLimit("single", ip, t0 + 30);
    expect(blocked.allowed).toBe(false);
    if (!blocked.allowed) {
      expect(blocked.retryAfterSec).toBeGreaterThan(0);
    }
  });

  it("scopes counters per IP and per bucket", () => {
    const t0 = 1_700_000_000_000;
    expect(checkRateLimit("batch", "10.0.0.1", t0).allowed).toBe(true);
    // batch limit is 1/min — second call from same IP is blocked.
    expect(checkRateLimit("batch", "10.0.0.1", t0 + 1).allowed).toBe(false);
    // Different IP is unaffected.
    expect(checkRateLimit("batch", "10.0.0.2", t0 + 2).allowed).toBe(true);
    // Single bucket on the same IP is independent.
    expect(checkRateLimit("single", "10.0.0.1", t0 + 3).allowed).toBe(true);
  });

  it("allows again after the window slides past", () => {
    const ip = "198.51.100.1";
    const t0 = 1_700_000_000_000;
    expect(checkRateLimit("batch", ip, t0).allowed).toBe(true);
    expect(checkRateLimit("batch", ip, t0 + 30_000).allowed).toBe(false);
    expect(checkRateLimit("batch", ip, t0 + 61_000).allowed).toBe(true);
  });
});
