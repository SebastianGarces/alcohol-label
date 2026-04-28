import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("next/headers", () => ({
  headers: async () => new Headers({ "x-forwarded-for": "127.0.0.1" }),
}));

vi.mock("@sentry/nextjs", () => ({
  captureException: vi.fn(),
  captureMessage: vi.fn(),
  withScope: (fn: (scope: { setTag: (k: string, v: string) => void }) => void) =>
    fn({ setTag: vi.fn() }),
}));

vi.mock("@/lib/verifier", () => ({
  verifyLabel: vi.fn(),
}));

import { verifyLabelAction } from "@/app/actions";
import { resetRateLimit } from "@/lib/rate-limit";
import { verifyLabel } from "@/lib/verifier";

const mockedVerify = vi.mocked(verifyLabel);

function makeForm(file: File): FormData {
  const fd = new FormData();
  fd.set("image", file);
  fd.set("beverageType", "distilled_spirits");
  fd.set("brandName", "Stone's Throw");
  fd.set("classType", "Kentucky Straight Bourbon Whiskey");
  fd.set("alcoholContent", "45%");
  fd.set("netContents", "750 mL");
  fd.set("bottlerName", "Stone's Throw Distillery");
  fd.set("bottlerAddress", "123 Main St, Louisville, KY");
  fd.set("importerName", "");
  fd.set("importerAddress", "");
  fd.set("countryOfOrigin", "");
  return fd;
}

describe("verifyLabelAction guards", () => {
  beforeEach(() => {
    mockedVerify.mockReset();
    resetRateLimit();
  });

  it("rejects images larger than 5 MB up front (image_too_small)", async () => {
    const huge = new File([new Uint8Array(5 * 1024 * 1024 + 1)], "big.jpg", {
      type: "image/jpeg",
    });
    const out = await verifyLabelAction(makeForm(huge));
    expect(out.ok).toBe(false);
    if (!out.ok) {
      expect(out.error.kind).toBe("image_too_small");
    }
    expect(mockedVerify).not.toHaveBeenCalled();
  });

  it("returns the not_alcohol_label error sentinel when the verifier flags it", async () => {
    mockedVerify.mockResolvedValueOnce({
      id: "r1",
      status: "fail",
      fields: [],
      warning: {
        status: "fail",
        extractedText: null,
        canonicalText: "",
        headerIsAllCaps: false,
        headerAppearsBold: false,
        failures: [{ kind: "missing", detail: "—" }],
      },
      durationMs: 100,
      imageHash: "hash",
      cached: false,
      timeout: false,
      error: "not_alcohol_label",
    });
    const small = new File([new Uint8Array(64)], "tiny.jpg", { type: "image/jpeg" });
    const out = await verifyLabelAction(makeForm(small));
    if (!out.ok) {
      throw new Error(`unexpected error: ${out.error.kind} — ${out.error.message}`);
    }
    expect(out.value.error).toBe("not_alcohol_label");
  });
});
