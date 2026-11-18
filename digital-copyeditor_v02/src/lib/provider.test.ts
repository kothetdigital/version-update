import { beforeEach, describe, expect, it, vi } from "vitest";
import { analyzeWithConfiguredProvider } from "./provider";
import { saveProviderConfig } from "./provider-config";
import { installMemoryStorage } from "./test-storage";

const input = { sourceText: "မူရင်းစာသား", targetStyle: "SPOKEN" as const, activePolicies: [] };

describe("configured proofreading providers", () => {
  beforeEach(() => {
    installMemoryStorage();
    vi.restoreAllMocks();
  });

  it("rejects proofreading when no API key is configured", async () => {
    await expect(analyzeWithConfiguredProvider(input)).rejects.toThrow("API key");
  });

  it("parses a Gemini structured response", async () => {
    saveProviderConfig({ kind: "GEMINI", apiKey: "test-key", model: "gemini-test", endpoint: "" });
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({
            candidates: [
              {
                content: {
                  parts: [
                    {
                      text: JSON.stringify({
                        correctedText: "ပြင်ပြီးစာ",
                        sentenceStructureSummary: "စစ်ဆေးပြီး",
                        structureIssues: [],
                        spellingNotes: [],
                        grammarNotes: [],
                        policyNotes: [],
                      }),
                    },
                  ],
                },
              },
            ],
          }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        ),
      ),
    );
    const result = await analyzeWithConfiguredProvider(input);
    expect(result.correctedText).toBe("ပြင်ပြီးစာ");
    expect(fetch).toHaveBeenCalledOnce();
  });

  it("includes matching workbook spelling entries in the provider prompt", async () => {
    saveProviderConfig({ kind: "GEMINI", apiKey: "test-key", model: "gemini-test", endpoint: "" });
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({
            candidates: [
              {
                content: {
                  parts: [
                    {
                      text: JSON.stringify({
                        correctedText: "ဂရုစိုက်",
                        sentenceStructureSummary: "စစ်ဆေးပြီး",
                        structureIssues: [],
                        spellingNotes: [],
                        grammarNotes: [],
                        policyNotes: [],
                      }),
                    },
                  ],
                },
              },
            ],
          }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        ),
      ),
    );
    await analyzeWithConfiguredProvider({ ...input, sourceText: "ဂရုစိုက်" });
    const request = vi.mocked(fetch).mock.calls[0]?.[1];
    const body = JSON.parse(String(request?.body));
    expect(body.contents[0].parts[0].text).toContain("ဂရုစိုက်");
  });

  it("rejects malformed provider JSON", async () => {
    saveProviderConfig({ kind: "GEMINI", apiKey: "test-key", model: "gemini-test", endpoint: "" });
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValue(
          new Response(
            JSON.stringify({ candidates: [{ content: { parts: [{ text: "not-json" }] } }] }),
            { status: 200 },
          ),
        ),
    );
    await expect(analyzeWithConfiguredProvider(input)).rejects.toThrow("JSON");
  });

  it("parses OpenAI-compatible custom responses and keeps remarks Burmese-only", async () => {
    saveProviderConfig({
      kind: "CUSTOM",
      apiKey: "test-key",
      model: "custom-test",
      endpoint: "https://example.test/v1/chat/completions",
    });
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({
            choices: [
              {
                message: {
                  content: [
                    {
                      type: "text",
                      text: JSON.stringify({
                        correctedText: "ပြင်ပြီးစာ",
                        sentenceStructureSummary: "English summary",
                        structureIssues: [
                          { original: "မူရင်း", suggestion: "ပြင်ပြီး", explanation: "English note" },
                        ],
                        spellingNotes: [],
                        grammarNotes: [],
                        policyNotes: ["English policy"],
                      }),
                    },
                  ],
                },
              },
            ],
          }),
          { status: 200 },
        ),
      ),
    );
    const result = await analyzeWithConfiguredProvider(input);
    expect(result.sentenceStructureSummary).not.toMatch(/[A-Za-z]/u);
    expect(result.structureIssues[0]?.explanation).not.toMatch(/[A-Za-z]/u);
    expect(result.policyNotes[0]).not.toMatch(/[A-Za-z]/u);
    expect(fetch).toHaveBeenCalledWith(
      "https://example.test/v1/chat/completions",
      expect.objectContaining({ method: "POST" }),
    );
  });
});
