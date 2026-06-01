import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { findReviewSlotByYmd, indexReviewSlotByYmd } from "./review-date.helper";

describe("findReviewSlotByYmd", () => {
  it("finds weekly slot when sundayDate is IST midnight stored as prior UTC day", () => {
    const istSundayMay25Utc = new Date("2026-05-24T18:30:00.000Z");
    const entries = [{ sundayDate: istSundayMay25Utc, label: "May 25" }];
    const byYmd = indexReviewSlotByYmd(entries, (e) => e.sundayDate);
    const slot = findReviewSlotByYmd(
      entries,
      byYmd,
      "2026-05-25",
      "2026-05",
      (e) => e.sundayDate,
    );
    assert.equal(slot?.label, "May 25");
  });

  it("finds daily slot when todayDate is IST midnight stored as prior UTC day", () => {
    const istJune1MidnightUtc = new Date("2026-05-31T18:30:00.000Z");
    const entries = [{ todayDate: istJune1MidnightUtc, label: "June 1" }];
    const byYmd = indexReviewSlotByYmd(entries, (e) => e.todayDate);
    const slot = findReviewSlotByYmd(
      entries,
      byYmd,
      "2026-06-01",
      "2026-06",
      (e) => e.todayDate,
    );
    assert.equal(slot?.label, "June 1");
  });
});
