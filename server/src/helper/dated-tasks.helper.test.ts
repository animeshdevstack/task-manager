import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  matchesCalendarYmd,
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
});
