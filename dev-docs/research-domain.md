# Domain Research: TTB Alcohol Label Verification

**Author:** Domain Researcher
**Date:** 2026-04-27
**Purpose:** Source-cited domain brief for the AI-Powered Alcohol Label Verification prototype. Downstream architecture should treat this as the canonical reference for what to compare and how strict to be.

---

## Key Facts (Quick Reference)

**Government Health Warning — exact verbatim text** (27 CFR 16.21):

> GOVERNMENT WARNING: (1) According to the Surgeon General, women should not drink alcoholic beverages during pregnancy because of the risk of birth defects. (2) Consumption of alcoholic beverages impairs your ability to drive a car or operate machinery, and may cause health problems.

- "GOVERNMENT WARNING" must be **all caps** and **bold**; the rest must **not** be bold (27 CFR 16.22).
- Must appear on a **contrasting background**, "separate and apart from all other information," and be readily legible.
- Min type size by container: ≤237 mL → 1 mm; >237 mL–3 L → 2 mm; >3 L → 3 mm.
- Max character density: 1 mm → 40 char/in; 2 mm → 25 char/in; 3 mm → 12 char/in.

**ABV format and tolerance — quick table**

| Beverage          | Required format                           | Tolerance                                     | Cite               |
|-------------------|-------------------------------------------|------------------------------------------------|--------------------|
| Distilled spirits | "X% alcohol by volume" (alc/vol, %, slash, "alc" abbrev. all OK) | ±0.3 percentage points                          | 27 CFR 5.65        |
| Wine ≤14% ABV     | "Alcohol __% by volume" (only required if stated; class/type label may substitute) | ±1.5 percentage points (cannot cross 14% line) | 27 CFR 4.36        |
| Wine >14% ABV     | "Alcohol __% by volume" (required)        | ±1.0 percentage points (cannot cross 14% line) | 27 CFR 4.36        |
| Malt beverage     | "X% alcohol by volume" (only required if alcohol comes from added nonbeverage flavors/ingredients, or by state law) | ±0.3 percentage points; floor of 0.5% if labeled ≥0.5% | 27 CFR 7.65        |

> Examples acceptable for spirits: `40% alc/vol`, `Alc. 40 percent by vol.`, `40% Alcohol by Volume` (27 CFR 5.65).

---

## 1. Government Health Warning Statement

**Confidence: High**

The mandatory text is fixed by statute (Alcoholic Beverage Labeling Act of 1988) and codified at 27 CFR Part 16. The exact, verbatim text:

> GOVERNMENT WARNING: (1) According to the Surgeon General, women should not drink alcoholic beverages during pregnancy because of the risk of birth defects. (2) Consumption of alcoholic beverages impairs your ability to drive a car or operate machinery, and may cause health problems.

Source: [27 CFR 16.21 — Mandatory label information](https://www.law.cornell.edu/cfr/text/27/16.21).

**Format rules (27 CFR 16.22):**

- "GOVERNMENT WARNING" → **capital letters + bold type**.
- Remainder of statement → **must not appear in bold**.
- Statement must be on **contrasting background**, **readily legible**, and **separate and apart from all other information**.
- Minimum type size:
  - Containers ≤237 mL (8 fl oz): not smaller than **1 mm**.
  - Containers >237 mL up to 3 L (~101 fl oz): not smaller than **2 mm**.
  - Containers >3 L: not smaller than **3 mm**.
- Maximum character density: 1 mm → ≤40 char/in; 2 mm → ≤25 char/in; 3 mm → ≤12 char/in.
- Statement "shall not be compressed in such a manner that the warning statement is not readily legible."

For prototype: an exact-string match (after normalizing whitespace and the "(1)" / "(2)" markers) is appropriate. Punctuation and the colon after "GOVERNMENT WARNING" matter — TTB has rejected COLAs over a missing comma (see Section 5).

Source: [27 CFR Part 16 (Cornell LII)](https://www.law.cornell.edu/cfr/text/27/part-16); [Blue Label Packaging summary citing 16.22](https://www.bluelabelpackaging.com/blog/3-reasons-why-the-ttb-turned-down-your-cola-and-how-to-avoid-them/).

---

## 2. Required Label Elements by Beverage Type

**Confidence: High** for fields and citations; **Medium** for the country-of-origin nuance (the actual marking duty lives in 19 CFR via Customs, not 27 CFR).

### Distilled Spirits — 27 CFR Part 5, Subpart E

Mandatory fields (27 CFR 5.63):

| Field                             | Section          | Notes                                                               |
|-----------------------------------|------------------|---------------------------------------------------------------------|
| Brand name                        | 5.64             | Must be in **same field of vision** as class/type and ABV.          |
| Class, type, or other designation | 5.22 / Subpart I | E.g., "Kentucky Straight Bourbon Whiskey".                          |
| Alcohol content                   | 5.65             | "% alcohol by volume". ±0.3% tolerance. Proof optional, supplemental.|
| Net contents                      | 5.70             | Standards of fill apply (50 mL–1.75 L for bottles).                  |
| Bottler/distiller name + address  | 5.66             | Or "Bottled by", "Distilled by", etc.                                |
| Importer name + address           | 5.67 / 5.68      | "Imported by …" required for imports.                                |
| Country of origin                 | 19 CFR 134 (CBP) | Imported spirits must be marked with country of origin.              |
| Government health warning         | 27 CFR 16.21     | Required on all alcohol beverages ≥0.5% ABV sold in the US.          |

**Same-field-of-vision rule (5.63(a)):** Brand name + class/type + ABV must be visible together without turning the bottle. This is a layout check, but matters for image-cropping logic.

Source: [27 CFR 5.63 (Cornell LII)](https://www.law.cornell.edu/cfr/text/27/5.63); [27 CFR 5.65](https://www.law.cornell.edu/cfr/text/27/5.65); [TTB DS Labeling Checklist (PDF)](https://www.ttb.gov/system/files/images/labeling-ds/ds-labeling-checklist.pdf).

### Wine — 27 CFR Part 4, Subpart D

Mandatory fields (27 CFR 4.32):

| Field                             | Section | Notes                                                                  |
|-----------------------------------|---------|------------------------------------------------------------------------|
| Brand name                        | 4.33    |                                                                        |
| Class, type, or other designation | 4.34    | Generic, varietal, semi-generic, geographic, etc. (Subpart C).         |
| Alcohol content                   | 4.36    | Required if >14% ABV. For ≤14%, "Table Wine" / "Light Wine" can stand in. |
| Net contents                      | 4.37    | One of nine authorized standards of fill.                              |
| Name + address (bottler/importer) | 4.35    |                                                                        |
| Sulfite declaration               | 4.32(e) | "Contains Sulfites" required if SO₂ ≥ 10 ppm.                          |
| Country of origin (imports)       | 19 CFR 134 (CBP) | TTB does not require it on the label; CBP does.              |
| Government warning                | 16.21   |                                                                        |

Source: [27 CFR 4.32 (Cornell LII)](https://www.law.cornell.edu/cfr/text/27/4.32); [27 CFR 4.36](https://www.law.cornell.edu/cfr/text/27/4.36); [27 CFR Part 4 (LII index)](https://www.law.cornell.edu/cfr/text/27/part-4).

### Malt Beverages (Beer) — 27 CFR Part 7, Subpart E

Mandatory fields (27 CFR 7.63):

| Field                             | Section          | Notes                                                            |
|-----------------------------------|------------------|------------------------------------------------------------------|
| Brand name                        | 7.64             |                                                                  |
| Class, type, or other designation | Subpart I        | "Beer," "Ale," "Lager," "Malt Liquor," etc.                       |
| Alcohol content                   | 7.65             | **Only required** if alcohol from added nonbeverage flavors/ingredients, or if state law requires. ±0.3% tolerance. |
| Bottler/importer name + address   | 7.66 / 7.67 / 7.68 | Three variants: domestic-bottled, domestic-bottled-after-import, imported-in-container. |
| Country of origin (imports)       | 7.69 (TTB) + 19 CFR 134 (CBP) | TTB **does** call it out specifically for malt beverages.   |
| Net contents                      | 7.70             |                                                                  |
| Government warning                | 16.21            |                                                                  |

Source: [27 CFR 7.63](https://www.law.cornell.edu/cfr/text/27/7.63); [27 CFR 7.65](https://www.law.cornell.edu/cfr/text/27/7.65).

> **Implication for the prototype:** the set of required fields differs by beverage type. A naive "all fields must match" check will over-flag (e.g., flagging a beer for missing ABV when ABV isn't required). Beverage-type-aware checks are needed.

---

## 3. Tolerance Rules

**Confidence: High.**

- **Distilled spirits:** ±0.3 percentage points between actual and labeled ABV. ([27 CFR 5.65](https://www.law.cornell.edu/cfr/text/27/5.65)). This was tightened from ±0.15% to ±0.3% in TTB's 2020 modernization rule.
- **Wine ≤14% ABV:** ±1.5 percentage points; **but** the actual ABV cannot cross the 14% threshold (a wine labeled 13.5% with actual 14.2% is non-compliant despite being within 1.5%). ([27 CFR 4.36](https://www.law.cornell.edu/cfr/text/27/4.36)).
- **Wine >14% ABV:** ±1.0 percentage points; same no-cross-14% rule.
- **Malt beverages:** ±0.3 percentage points, with hard floor — anything labeled ≥0.5% must actually contain ≥0.5%. "Non-alcoholic" requires <0.5% and the phrase "contains less than 0.5 percent alcohol by volume" adjacent. "Alcohol free" = exactly zero. ([27 CFR 7.65](https://www.law.cornell.edu/cfr/text/27/7.65)).

> **Important caveat for the prototype:** TTB's tolerances govern *actual lab-tested ABV vs. labeled ABV*. They do **not** govern the discrepancy between the **labeled ABV** and the **application's stated ABV** — those should match exactly (see Section 5). The tolerance is irrelevant to the COLA review's label-vs-application comparison; it matters only to post-market enforcement testing. This is a common point of confusion.

---

## 4. Brand-Name Matching Nuance

**Confidence: Medium-Low** (no single regulation answers this; multiple TTB practice signals point in the same direction).

The brief's example: label says "STONE'S THROW", application says "Stone's Throw". Is this a mismatch?

- **Per 27 CFR 5.64 / 4.33 / 7.64**, the "brand name" is the name under which the product is marketed. There is **no regulation** stating that capitalization or punctuation differences between the application form and the label artwork constitute a mismatch.
- TTB's [Allowable Revisions / Allowable Changes](https://www.ttb.gov/regulated-commodities/labeling/allowable-revisions) guidance permits, *post-approval*, "appropriate changes to the spelling (including punctuation marks and abbreviations)" of words, **as long as the brand name is not changed**. This implies TTB treats the brand-name *identity* as what's substantive, not the case/punctuation rendering.
- However, for the **warning statement** specifically, capitalization, punctuation, and bolding must match the regulation exactly — even a missing comma has caused rejection ([Blue Label Packaging](https://www.bluelabelpackaging.com/blog/3-reasons-why-the-ttb-turned-down-your-cola-and-how-to-avoid-them/)).
- One legal-practitioner summary states: "the capitalization, punctuation, and formatting of your brand name on your submitted label must match precisely what you're applying for in your COLA." This refers to consistency between **what was applied for** and **what was actually printed** on the produced bottle (a post-approval audit concern), not to whether "STONE'S THROW" on a label matches "Stone's Throw" typed into a form field.

**Practical conclusion:** No authoritative TTB regulation says "case differences = mismatch." TTB agents (per Dave's hallway interview in the brief) treat case differences as obvious equivalences. The prototype should normalize for case, and probably for surrounding whitespace and most punctuation, when comparing brand names. Apostrophe variants (`'` vs. `'`), accented characters, and stylized spellings ("ye olde") need explicit handling. Different *words* (e.g., "Stone's Throw" vs. "Stones Throwing") = real mismatch.

> **Suggested matching ladder for the prototype:**
> 1. Exact match → green.
> 2. Case-insensitive + whitespace-collapsed + smart-quote-normalized match → green with a "case-normalized" note.
> 3. Levenshtein within 2 or token-set match ≥0.9 → yellow, surface to agent.
> 4. Below that → red.

Sources: [27 CFR 5.64](https://www.law.cornell.edu/cfr/text/27/5.64); [TTB Allowable Revisions](https://www.ttb.gov/regulated-commodities/labeling/allowable-revisions); [Blue Label rejection patterns](https://www.bluelabelpackaging.com/blog/3-reasons-why-the-ttb-turned-down-your-cola-and-how-to-avoid-them/).

---

## 5. Commonly-Wrong Label Elements

**Confidence: Medium** (rejection-rate stats not publicly itemized; this is a synthesis of TTB guidance and practitioner blogs).

In rough order of frequency reported by TTB-practice attorneys and label printers:

1. **Government warning formatting** — wrong capitalization (title case "Government Warning" instead of "GOVERNMENT WARNING"), missing bold on first two words, font too small for container size, missing comma/colon, paraphrased wording, broken across two non-adjacent lines, low contrast. ([Blue Label](https://www.bluelabelpackaging.com/blog/3-reasons-why-the-ttb-turned-down-your-cola-and-how-to-avoid-them/), [Zahn Law](https://www.zahnlawpc.com/top-things-people-get-wrong-on-their-ttb-labels/)).
2. **Class/type designation mismatch or use of unauthorized type** — especially RTDs, flavored whiskeys, novel infusions. The application says "vodka specialty" but the label says "vodka."
3. **ABV format** — "ALC. VOL. 13.5" without "%", missing "by volume," or using only proof on a spirit without ABV.
4. **Net contents** — non-authorized standard of fill (esp. wine), wrong type-size, wrong unit ("750 ml" should be "750 mL").
5. **Statement of composition mismatch with formula** for distilled spirits specialties.
6. **Geographic / AVA claims** unsupported (e.g., "Napa Valley" without meeting 85% sourcing).
7. **Missing or wrong bottler/importer address** — typo, missing city, wrong state abbreviation.
8. **Brand name conflicts** — name implies a misleading geographic origin or duplicates a registered brand.

> **Implication for the prototype:** the highest-yield checks (in order) are: warning text exact-match, class/type match, ABV value+format match, net contents match, brand name match. These map directly to the brief's "matching" agent workload.

Sources: [Zahn Law - Top Things People Get Wrong](https://www.zahnlawpc.com/top-things-people-get-wrong-on-their-ttb-labels/), [Blue Label Packaging - 3 Reasons](https://www.bluelabelpackaging.com/blog/3-reasons-why-the-ttb-turned-down-your-cola-and-how-to-avoid-them/), [FX5 - Avoiding COLA Pitfalls](https://fx5.com/avoiding-common-cola-submission-pitfalls-a-guide-for-us-distillers/).

---

## 6. The COLA Process and Timeline

**Confidence: Medium-High.**

- **What's submitted:** TTB Form 5100.31. Application contains: applicant info (permit number), product class/type, brand name, fanciful name, net contents, ABV, formula reference (for spirits specialties), and label artwork as image attachments (front, back, side, neck, etc.).
- **What the agent sees:** All form fields plus the rendered label images. The agent compares each form field to its corresponding text on the artwork. The agent also evaluates the label as a whole for non-mandatory issues (misleading statements, prohibited terms, geographic claims).
- **What gets matched against what:** brand name (form ↔ label), class/type (form ↔ label), ABV (form ↔ label), net contents (form ↔ label), bottler/importer name + address (form ↔ label), formula compliance (formula ↔ label statement of composition), and the warning is checked against the regulatory canonical text.
- **Volume:** ~150,000 applications/year (per the brief; consistent with TTB historical numbers).
- **Timeline (current):** Median processing varies by beverage type and load. Most recent TTB published medians (2026) trend ~2–10 days for spirits/wine/beer when uncorrected; resubmissions are prioritized. ([TTB Processing Times](https://www.ttb.gov/regulated-commodities/labeling/processing-times)).
- **Allowable post-approval changes:** Don't require a new COLA — see [TTB Allowable Revisions](https://www.ttb.gov/regulated-commodities/labeling/allowable-revisions). Brand-name and class/type changes always require resubmission.

> **Implication for the prototype:** the comparison surface is small and well-defined: ~5–7 fields per beverage type, plus the warning text. This is well within scope for an OCR-+-LLM extraction pipeline.

Sources: [TTB COLA Public Registry](https://www.ttb.gov/labeling/cola-public-registry), [TTB Processing Times](https://www.ttb.gov/regulated-commodities/labeling/processing-times), [TTB COLA FAQs](https://www.ttb.gov/faqs/colas-and-formulas-online-faqs/print).

---

## 7. Document Retention & PII

**Confidence: High.**

- A COLA application is a **public record** once approved — TTB publishes the artwork and many fields in the [COLA Public Registry](https://www.ttb.gov/labeling/cola-public-registry). Anyone can pull up an approved label by registry number.
- Therefore the **label image** itself contains no PII. It is essentially commercial trade dress.
- Sensitive items in the broader application (not on the label): permit numbers and applicant contact info — these can be considered Controlled Unclassified Information (CUI), but again, do not appear on the label.
- TTB does retain the label image and metadata indefinitely.

> **Implication for the prototype:** the brief's "no PII for the prototype" instruction is a conservative simplification; actually, TTB labels are inherently public. The prototype can safely cache label images, but should not retain any agent identity or business-confidential data beyond the session unless asked.

Source: [TTB COLA Public Registry](https://www.ttb.gov/labeling/cola-public-registry).

---

## Gotchas

1. **Wine ABV is conditional, not always required.** Wines ≤14% ABV can omit ABV entirely if the class/type ("Table Wine," "Light Wine") covers it. A "missing ABV" check will false-positive on wine if not beverage-type-aware. ([27 CFR 4.36](https://www.law.cornell.edu/cfr/text/27/4.36))
2. **Beer ABV is also conditional.** Most beers don't legally require ABV on the label; it's required only when the alcohol comes from added nonbeverage flavors/ingredients, or when the state requires it. ([27 CFR 7.65](https://www.law.cornell.edu/cfr/text/27/7.65))
3. **Wine 14% threshold is a hard line.** Tolerance never crosses it: a wine labeled 13.9% with actual 14.1% is out-of-spec even though 0.2% < 1.5%.
4. **Tolerance is for actual-vs-labeled, not form-vs-label.** The COLA review compares the *form* to the *label*. Both numbers are paper artifacts and should match exactly. ABV tolerance only matters at post-market lab testing.
5. **Same-field-of-vision** rule for spirits (5.63(a)): brand + class + ABV must be visible together. A multi-image submission split across faces could mask this.
6. **"GOVERNMENT WARNING" is the literal string.** Variants like "Govt. Warning," "Government Warning:" (title case), or "WARNING:" alone are non-compliant. Bold is required only on those two opening words; bolding the whole paragraph is also a defect.
7. **Country of origin** is enforced by US Customs (19 CFR 134), not directly by TTB on the label — but TTB does require importer name + address per Part 5/7. So "country of origin" appears on most imported labels but isn't strictly a 27 CFR field for spirits/wine; for malt beverages it is (7.69).
8. **The "STONE'S THROW" vs "Stone's Throw" issue is a UI problem, not a regulatory one.** No CFR section mandates case-sensitive matching between form text and label text. The prototype can confidently treat case-only differences as matches and surface the underlying string.
9. **Smart quotes vs. straight quotes** in apostrophes/possessives are a common OCR-vs-form mismatch. Normalize before comparing.
10. **Proof is optional and supplemental.** A spirits label with "90 Proof" and no "% alc/vol" is non-compliant; a label with both is fine. The form field is ABV; proof = 2 × ABV (US).

---

## Sources

Primary regulations (Cornell LII mirrors of 27 CFR):
- [27 CFR Part 16 (Health Warning Statement)](https://www.law.cornell.edu/cfr/text/27/part-16)
- [27 CFR 16.21](https://www.law.cornell.edu/cfr/text/27/16.21), [27 CFR 16.22](https://www.law.cornell.edu/cfr/text/27/16.22)
- [27 CFR Part 4 (Wine)](https://www.law.cornell.edu/cfr/text/27/part-4) — esp. [4.32](https://www.law.cornell.edu/cfr/text/27/4.32), [4.36](https://www.law.cornell.edu/cfr/text/27/4.36)
- [27 CFR Part 5 (Distilled Spirits)](https://www.law.cornell.edu/cfr/text/27/part-5) — esp. [5.63](https://www.law.cornell.edu/cfr/text/27/5.63), [5.65](https://www.law.cornell.edu/cfr/text/27/5.65)
- [27 CFR Part 7 (Malt Beverages)](https://www.law.cornell.edu/cfr/text/27/part-7) — esp. [7.63](https://www.law.cornell.edu/cfr/text/27/7.63), [7.65](https://www.law.cornell.edu/cfr/text/27/7.65)

TTB official guidance:
- [TTB Distilled Spirits Labeling Checklist (PDF)](https://www.ttb.gov/system/files/images/labeling-ds/ds-labeling-checklist.pdf)
- [TTB Beverage Alcohol Manual — Distilled Spirits (PDF)](https://www.ttb.gov/system/files/images/pdfs/wine_bam/complete-distilled-spirit-beverage-alcohol-manual.pdf)
- [TTB Beverage Alcohol Manual — Wine (PDF)](https://www.ttb.gov/images/pdfs/wine_bam/complete-wine-beverage-alcohol-manual.pdf)
- [TTB Allowable Revisions to Approved Labels](https://www.ttb.gov/regulated-commodities/labeling/allowable-revisions)
- [TTB COLA Public Registry](https://www.ttb.gov/labeling/cola-public-registry)
- [TTB Label Processing Times](https://www.ttb.gov/regulated-commodities/labeling/processing-times)

Practitioner secondary sources (used for rejection-pattern signals):
- [Blue Label Packaging — 3 Reasons COLA Rejected](https://www.bluelabelpackaging.com/blog/3-reasons-why-the-ttb-turned-down-your-cola-and-how-to-avoid-them/)
- [Zahn Law — Top Things People Get Wrong on TTB Labels](https://www.zahnlawpc.com/top-things-people-get-wrong-on-their-ttb-labels/)
- [FX5 — Avoiding Common COLA Submission Pitfalls](https://fx5.com/avoiding-common-cola-submission-pitfalls-a-guide-for-us-distillers/)
