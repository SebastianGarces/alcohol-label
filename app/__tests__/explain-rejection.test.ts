import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/vlm/explain", () => ({
  explainRejection: vi.fn(),
}));

import { explainRejectionAction } from "@/app/actions";
import { VlmAuthError, VlmTimeoutError } from "@/lib/vlm/call";
import { explainRejection } from "@/lib/vlm/explain";

const mockedExplain = vi.mocked(explainRejection);

const fieldPayload = {
  kind: "field" as const,
  field: "brandName" as const,
  applicationValue: "Stone's Throw",
  labelValue: "Stones Throw",
  status: "mismatch",
  rationale: "Different values (similarity 0.84)",
};

describe("explainRejectionAction", () => {
  beforeEach(() => {
    mockedExplain.mockReset();
  });

  it("returns the Sonnet explanation on the happy path", async () => {
    mockedExplain.mockResolvedValueOnce(
      "The brand name is missing an apostrophe; ask the applicant to update the label.",
    );

    const result = await explainRejectionAction(fieldPayload);

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.explanation).toMatch(/apostrophe/);
    }
    expect(mockedExplain).toHaveBeenCalledOnce();
  });

  it("returns a friendly Result error when Sonnet fails", async () => {
    mockedExplain.mockRejectedValueOnce(new Error("upstream 500"));

    const result = await explainRejectionAction(fieldPayload);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.kind).toBe("vlm_error");
      expect(result.error.message).toMatch(/couldn't draft/i);
    }
  });

  it("maps timeouts and auth errors to typed Result errors", async () => {
    mockedExplain.mockRejectedValueOnce(new VlmTimeoutError());
    const t = await explainRejectionAction(fieldPayload);
    expect(t.ok).toBe(false);
    if (!t.ok) expect(t.error.kind).toBe("vlm_timeout");

    mockedExplain.mockRejectedValueOnce(new VlmAuthError("401"));
    const a = await explainRejectionAction(fieldPayload);
    expect(a.ok).toBe(false);
    if (!a.ok) expect(a.error.kind).toBe("auth_error");
  });

  it("rejects malformed payloads at the schema boundary", async () => {
    const result = await explainRejectionAction({ kind: "nope" });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.kind).toBe("vlm_error");
    expect(mockedExplain).not.toHaveBeenCalled();
  });
});
