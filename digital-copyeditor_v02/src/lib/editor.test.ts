import { describe, expect, it } from "vitest";
import { burmeseOnly, limitSourceText, MAX_SOURCE_CHARACTERS } from "./editor";

describe("editor input safeguards", () => {
  it("limits source text to 50,000 characters", () => {
    const source = "က".repeat(MAX_SOURCE_CHARACTERS + 25);
    expect(limitSourceText(source)).toHaveLength(MAX_SOURCE_CHARACTERS);
  });

  it("replaces provider remarks that contain English", () => {
    expect(burmeseOnly("English explanation")).toContain("မြန်မာဘာသာ");
    expect(burmeseOnly("မြန်မာစာ မှတ်ချက်")).toBe("မြန်မာစာ မှတ်ချက်");
  });
});
