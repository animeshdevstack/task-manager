import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  getCurrentMonthYmInTimezone,
  getTodayYmdInTimezone,
  getUserTimezone,
} from "./user-timezone.helper";

describe("user-timezone.helper", () => {
  it("getUserTimezone reads X-User-Timezone header", () => {
    assert.equal(
      getUserTimezone({ headers: { "x-user-timezone": "Asia/Kolkata" } }),
      "Asia/Kolkata",
    );
  });

  it("getUserTimezone falls back to UTC for invalid timezone", () => {
    assert.equal(
      getUserTimezone({ headers: { "x-user-timezone": "Not/A/Timezone" } }),
      "UTC",
    );
    assert.equal(getUserTimezone({ headers: {} }), "UTC");
  });

  it("Asia/Kolkata at 2026-07-31T20:00:00Z is already August 1", () => {
    const instant = new Date("2026-07-31T20:00:00.000Z");
    assert.equal(getTodayYmdInTimezone("Asia/Kolkata", instant), "2026-08-01");
    assert.equal(getCurrentMonthYmInTimezone("Asia/Kolkata", instant), "2026-08");
  });

  it("UTC at 2026-07-31T20:00:00Z is still July 31", () => {
    const instant = new Date("2026-07-31T20:00:00.000Z");
    assert.equal(getTodayYmdInTimezone("UTC", instant), "2026-07-31");
    assert.equal(getCurrentMonthYmInTimezone("UTC", instant), "2026-07");
  });
});
