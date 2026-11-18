import { describe, expect, it } from "vitest";
import { BakeSommelierError } from "./gemini";
import { parseVisionResult } from "./vision";

const meta = { model: "gemini-3.8-flash", photoCount: 2, at: "2026-01-01T00:00:00.000Z" };

describe("photo read parsing", () => {
  it("keeps known tags, clamps ratings and ignores fields photos cannot support", () => {
    const read = parseVisionResult(
      '```json\n{"summary":"  Even char with a pale   base. ","observations":["Pale underside","Tight crumb at the rim"],"confidence":"high","ratings":{"crust":4.4,"crumb":0,"flavor":5,"overall":9},"tags":["charred","open-crumb","made-up"]}\n```',
      meta,
    );

    expect(read.summary).toBe("Even char with a pale base.");
    expect(read.ratings).toEqual({ crust: 4, overall: 5 });
    expect(read.tags).toEqual(["open-crumb", "charred"]);
    expect(read.confidence).toBe("high");
    expect(read.photoCount).toBe(2);
    expect(read.model).toBe("gemini-3.8-flash");
  });

  it("defaults unknown confidence to medium and drops empty text", () => {
    const read = parseVisionResult(
      '{"summary":"Golden rim.","confidence":"certain","ratings":{},"tags":[]}',
      meta,
    );
    expect(read.confidence).toBe("medium");
    expect(read.ratings).toEqual({});
    expect(read.observations).toEqual([]);
  });

  it("rejects an unreadable or empty answer", () => {
    expect(() => parseVisionResult("not json", meta)).toThrow(BakeSommelierError);
    expect(() => parseVisionResult('{"summary":"   "}', meta)).toThrow(BakeSommelierError);
  });
});
