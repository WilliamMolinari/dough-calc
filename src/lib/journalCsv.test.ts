import { describe, expect, it } from "vitest";
import { csvCell, journalCsv } from "./exports";
import { BASE_FORMULA } from "./presets";
import type { BakeEntry } from "./types";

function bake(overrides: Partial<BakeEntry> = {}): BakeEntry {
  return {
    id: "a",
    createdAt: "2026-11-01T09:00:00.000Z",
    name: "Friday 65%",
    styleId: "new-york",
    styleName: "New York",
    formula: { ...BASE_FORMULA, hydration: 65, ballCount: 4, ballWeight: 280 },
    unit: "g",
    ratings: { crust: 4, crumb: 5, extensibility: 3, flavor: 4, overall: 5 },
    notes: "Puffed fast",
    flourBrand: "Caputo",
    oven: "Home steel",
    tags: ["cold ferment"],
    photos: [],
    totalDough: 1200,
    nextTimeNotes: "20 g more water",
    ...overrides,
  };
}

describe("journal CSV", () => {
  it("quotes only the cells that need it", () => {
    expect(csvCell("plain")).toBe("plain");
    expect(csvCell("with, comma")).toBe('"with, comma"');
    expect(csvCell('say "hi"')).toBe('"say ""hi"""');
    expect(csvCell("two\nlines")).toBe('"two\nlines"');
    expect(csvCell(undefined)).toBe("");
    expect(csvCell(0)).toBe("0");
  });

  it("writes a header plus one row per bake, with a BOM for Excel", () => {
    const csv = journalCsv([bake(), bake({ id: "b", name: "New Haven" })]);
    expect(csv.startsWith("\uFEFF")).toBe(true);
    const lines = csv.replace(/^\uFEFF/, "").split("\r\n");
    expect(lines).toHaveLength(3);
    expect(lines[0]).toContain("Hydration %");
    expect(lines[1]).toContain("Friday 65%");
    expect(lines[2]).toContain("New Haven");
  });

  it("escapes notes without breaking the row count", () => {
    const csv = journalCsv([bake({ notes: 'Great, but "salty"\nnext time less' })]);
    const body = csv.replace(/^\uFEFF/, "");
    expect(body).toContain('"Great, but ""salty""\nnext time less"');
    // The embedded newline lives inside quotes, so the record still has two lines.
    expect(body.split("\r\n").filter((line) => line.startsWith("2026-11-01"))).toHaveLength(1);
  });

  it("leaves unrated stars blank instead of writing zeros", () => {
    const csv = journalCsv([
      bake({
        ratings: { crust: 0, crumb: 0, extensibility: 0, flavor: 0, overall: 0 },
      }),
    ]);
    expect(csv).toContain("Home steel,,,,");
  });
});
