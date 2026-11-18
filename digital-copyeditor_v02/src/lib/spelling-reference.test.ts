import { describe, expect, it } from "vitest";
import { getSpellingReference, spellingReferenceLimit } from "./spelling-reference";

describe("Myanmar spelling reference", () => {
  it("returns terms from the supplied workbook when they occur in the source", () => {
    expect(getSpellingReference("ဂရုစိုက်")).toContain("ဂရုစိုက်");
  });

  it("does not invent a reference entry for an empty source", () => {
    expect(getSpellingReference("")).toEqual([]);
  });

  it("keeps the provider reference bounded", () => {
    expect(getSpellingReference("ဂရုစိုက် ".repeat(200))).toHaveLength(1);
    expect(spellingReferenceLimit).toBe(80);
  });
});
