import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { isAllowedDatedTaskDate } from "../helper/dated-tasks.helper";
import {
  getCurrentMonthYmInTimezone,
  getTodayYmdInTimezone,
} from "../helper/user-timezone.helper";

describe("timezone-aware task plan validation", () => {
  const istMidnightWindow = new Date("2026-07-31T20:00:00.000Z");

  it("user in Asia/Kolkata sees August while UTC is still July", () => {
    assert.equal(getCurrentMonthYmInTimezone("Asia/Kolkata", istMidnightWindow), "2026-08");
    assert.equal(getTodayYmdInTimezone("Asia/Kolkata", istMidnightWindow), "2026-08-01");
    assert.equal(getCurrentMonthYmInTimezone("UTC", istMidnightWindow), "2026-07");
  });

  it("isAllowedDatedTaskDate compares against referenceYmd when provided", () => {
    const julyReference = new Date("2026-07-15T12:00:00.000Z");
    assert.equal(
      isAllowedDatedTaskDate(
        "2026-08-01",
        "2026-08",
        julyReference,
        "2026-08-01",
      ),
      true,
    );
    assert.equal(
      isAllowedDatedTaskDate(
        "2026-07-31",
        "2026-08",
        julyReference,
        "2026-08-01",
      ),
      false,
    );
  });
});
