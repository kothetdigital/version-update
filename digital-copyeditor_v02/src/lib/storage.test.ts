import { beforeEach, describe, expect, it } from "vitest";
import { getHistory, getPolicies, saveDraft, saveHistory, savePolicies, getDraft } from "./storage";
import { installMemoryStorage } from "./test-storage";

describe("local editor storage", () => {
  beforeEach(() => installMemoryStorage());

  it("round-trips a Burmese draft", () => {
    const text = "မြန်မာစာ စစ်ဆေးမည်။";
    saveDraft(text);
    expect(getDraft()).toBe(text);
  });

  it("filters corrupt policy and history records instead of crashing", () => {
    const storage = installMemoryStorage();
    storage.setItem(
      "ko_thet_editor_policies",
      JSON.stringify([{ id: "ok", ruleText: "ကျနော်", isActive: true }, { broken: true }]),
    );
    storage.setItem(
      "ko_thet_editor_history",
      JSON.stringify([{ id: "ok", sourceText: "စာ", result: {} }, { broken: true }]),
    );
    expect(getPolicies()).toHaveLength(1);
    expect(getHistory()).toHaveLength(1);
  });

  it("stores and retrieves session collections", () => {
    const session = {
      id: "1",
      sourceText: "စာ",
      createdAt: new Date().toISOString(),
      result: {
        targetStyle: "SPOKEN" as const,
        sentenceStructureSummary: "ok",
        structureIssues: [],
        correctedText: "စာ",
        spellingNotes: [],
        grammarNotes: [],
        policyNotes: [],
      },
    };
    savePolicies([
      {
        id: "p",
        label: "House",
        ruleText: "ကျနော်",
        isActive: true,
        createdAt: session.createdAt,
        updatedAt: session.createdAt,
      },
    ]);
    saveHistory([session]);
    expect(getPolicies()[0]?.label).toBe("House");
    expect(getHistory()[0]?.result.correctedText).toBe("စာ");
  });
});
