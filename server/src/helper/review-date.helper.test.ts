import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { formatDateYmd, formatDateYmdUtc } from "./dated-tasks.helper";
import {
  calendarDateToUtcNoon,
  findReviewSlotByYmd,
  getAllDaysInMonth,
  indexReviewSlotByYmd,
} from "./review-date.helper";

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

  it("returns Aug 1 slot not Aug 2 when both index under 2026-08-01 UTC key", () => {
    const aug1IstMidnight = new Date("2026-07-31T18:30:00.000Z");
    const aug2IstMidnight = new Date("2026-08-01T18:30:00.000Z");
    const entries = [
      { todayDate: aug1IstMidnight, label: "Aug 1" },
      { todayDate: aug2IstMidnight, label: "Aug 2" },
    ];
    const byYmd = indexReviewSlotByYmd(entries, (e) => e.todayDate);
    const slot = findReviewSlotByYmd(
      entries,
      byYmd,
      "2026-08-01",
      "2026-08",
      (e) => e.todayDate,
    );
    assert.equal(slot?.label, "Aug 1");
  });

  it("returns Aug 2 slot not Aug 1 for UTC-noon entries", () => {
    const aug1Noon = new Date("2026-08-01T12:00:00.000Z");
    const aug2Noon = new Date("2026-08-02T12:00:00.000Z");
    const entries = [
      { todayDate: aug1Noon, label: "Aug 1", Task: [{ isCompleted: true }] },
      { todayDate: aug2Noon, label: "Aug 2", Task: [{ isCompleted: false }] },
    ];
    const byYmd = indexReviewSlotByYmd(entries, (e) => e.todayDate);
    const slot = findReviewSlotByYmd(
      entries,
      byYmd,
      "2026-08-02",
      "2026-08",
      (e) => e.todayDate,
    );
    assert.equal(slot?.label, "Aug 2");
  });
});

describe("UTC noon calendar slots", () => {
  it("getAllDaysInMonth uses UTC noon with stable YMD formatting", () => {
    const days = getAllDaysInMonth("2026-08");
    const aug1 = days[0]!;
    assert.equal(aug1.ymd, "2026-08-01");
    assert.equal(aug1.date.toISOString(), "2026-08-01T12:00:00.000Z");
    assert.equal(formatDateYmd(aug1.date), "2026-08-01");
    assert.equal(formatDateYmdUtc(aug1.date), "2026-08-01");
  });

  it("calendarDateToUtcNoon matches expected instant", () => {
    const d = calendarDateToUtcNoon(2026, 7, 1);
    assert.equal(d.toISOString(), "2026-08-01T12:00:00.000Z");
  });
});
