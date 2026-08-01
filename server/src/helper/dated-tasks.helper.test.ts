import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  getLastDateOfMonth,
  instantMatchesCalendarYmd,
  matchesCalendarYmd,
  matchesReviewSlotYmd,
  parsePatchDateYmd,
  resolvePatchDateYmd,
} from "./dated-tasks.helper";

describe("dated-tasks.helper", () => {
  it("resolvePatchDateYmd prefers explicit dateYmd over ISO instant", () => {
    assert.equal(
      resolvePatchDateYmd({
        dateYmd: "2026-06-01",
        date: "2026-05-31T18:30:00.000Z",
      }),
      "2026-06-01",
    );
  });

  it("parsePatchDateYmd accepts YYYY-MM-DD strings", () => {
    assert.equal(parsePatchDateYmd("2026-06-01"), "2026-06-01");
  });

  it("matchesCalendarYmd when local and UTC YMD agree", () => {
    const noonUtc = new Date("2026-06-01T12:00:00.000Z");
    assert.equal(matchesCalendarYmd(noonUtc, "2026-06-01"), true);
  });

  it("instantMatchesCalendarYmd matches IST-midnight stored as prior UTC evening", () => {
    const istJune1MidnightUtc = new Date("2026-05-31T18:30:00.000Z");
    assert.equal(instantMatchesCalendarYmd(istJune1MidnightUtc, "2026-06-01"), true);
  });

  it("monthly PATCH accepts targetYmd against shifted monthEndDate", () => {
    const istMay31MidnightUtc = new Date("2026-05-30T18:30:00.000Z");
    const monthEndYmd = getLastDateOfMonth("2026-05");
    assert.equal(monthEndYmd, "2026-05-31");
    assert.equal(instantMatchesCalendarYmd(istMay31MidnightUtc, monthEndYmd), true);
  });

  it("matchesReviewSlotYmd rejects UTC-noon cross-day range bleed", () => {
    const aug1Noon = new Date("2026-08-01T12:00:00.000Z");
    assert.equal(matchesReviewSlotYmd(aug1Noon, "2026-08-01"), true);
    assert.equal(matchesReviewSlotYmd(aug1Noon, "2026-08-02"), false);
  });

  it("matchesReviewSlotYmd still matches legacy IST-midnight slots", () => {
    const istJune1MidnightUtc = new Date("2026-05-31T18:30:00.000Z");
    assert.equal(matchesReviewSlotYmd(istJune1MidnightUtc, "2026-06-01"), true);
  });
});
