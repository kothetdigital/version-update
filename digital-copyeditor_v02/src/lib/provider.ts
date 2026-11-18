import type { EditorialResult, HousePolicy, TargetStyle } from "./types";
import {
  getProviderConfig,
  isProviderProxyEnabled,
  providerProxyUrl,
  type ProviderConfig,
} from "./provider-config";
import { burmeseOnly } from "./editor";
import { getSpellingReference } from "./spelling-reference";

export const PROVIDER_REQUEST_TIMEOUT_MS = 30_000;

export interface CopyEditingProvider {
  analyze(input: {
    sourceText: string;
    targetStyle: TargetStyle;
    activePolicies: HousePolicy[];
  }): Promise<EditorialResult>;
}

function buildPrompt(input: {
  sourceText: string;
  targetStyle: TargetStyle;
  activePolicies: HousePolicy[];
}) {
  const policies =
    input.activePolicies.length === 0
      ? "None"
      : input.activePolicies.map((policy) => `- ${policy.ruleText}`).join("\n");
  const spellingReference = getSpellingReference(input.sourceText);
  const spellingReferenceText =
    spellingReference.length === 0
      ? "No exact reference entry was found."
      : spellingReference.map((term) => `- ${term}`).join("\n");
  return `Edit this Myanmar text for ${input.targetStyle === "SPOKEN" ? "natural spoken" : "written/literary"} style. Preserve meaning. Apply these house policies when relevant:\n${policies}\n\nReturn JSON only with this shape: {"targetStyle":"SPOKEN|WRITTEN","sentenceStructureSummary":"string","structureIssues":[{"original":"string","suggestion":"string","explanation":"string"}],"correctedText":"string","spellingNotes":[{"original":"string","suggestion":"string","explanation":"string"}],"grammarNotes":[{"original":"string","suggestion":"string","explanation":"string"}],"policyNotes":["string"]}\n\nImportant: correctedText must preserve Burmese meaning. All summaries, explanations, and policyNotes values must be Burmese Unicode only. Do not write English in remarks or notes.\n\nThe supplied spelling lexicon is a user-provided reference list, not a complete authority. Use matching entries as spelling evidence and preserve their contextual parenthetical glosses when relevant. Do not mark a word as wrong only because it is absent from this list.\n\nRelevant spelling reference entries:\n${spellingReferenceText}\n\nSource text:\n${input.sourceText}`;
}

function parseProviderResult(value: unknown, targetStyle: TargetStyle): EditorialResult {
  let candidate: unknown;
  try {
    candidate =
      typeof value === "string"
        ? JSON.parse(value.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, ""))
        : value;
  } catch {
    throw new Error("Provider မှ JSON ရလဒ်မှန်ကန်စွာ မရရှိပါ။");
  }
  const data = (candidate ?? {}) as Partial<EditorialResult>;
  if (typeof data.correctedText !== "string" || !data.correctedText.trim())
    throw new Error("Provider မှ မှန်ကန်သော JSON ရလဒ် မရရှိပါ။");
  const isNote = (item: unknown): item is EditorialResult["structureIssues"][number] =>
    Boolean(
      item &&
      typeof item === "object" &&
      typeof (item as EditorialResult["structureIssues"][number]).original === "string" &&
      typeof (item as EditorialResult["structureIssues"][number]).suggestion === "string" &&
      typeof (item as EditorialResult["structureIssues"][number]).explanation === "string",
    );
  return {
    targetStyle,
    sentenceStructureSummary: burmeseOnly(data.sentenceStructureSummary, "ဝါကျဖွဲ့ထုံးကို စစ်ဆေးထားသည်။"),
    correctedText: data.correctedText ?? "",
    structureIssues: Array.isArray(data.structureIssues)
      ? data.structureIssues
          .filter(isNote)
          .map((item) => ({ ...item, explanation: burmeseOnly(item.explanation) }))
      : [],
    spellingNotes: Array.isArray(data.spellingNotes)
      ? data.spellingNotes
          .filter(isNote)
          .map((item) => ({ ...item, explanation: burmeseOnly(item.explanation) }))
      : [],
    grammarNotes: Array.isArray(data.grammarNotes)
      ? data.grammarNotes
          .filter(isNote)
          .map((item) => ({ ...item, explanation: burmeseOnly(item.explanation) }))
      : [],
    policyNotes: Array.isArray(data.policyNotes)
      ? data.policyNotes
          .filter((item): item is string => typeof item === "string")
          .map((item) => burmeseOnly(item))
      : [],
  };
}

async function fetchWithTimeout(input: RequestInfo | URL, init: RequestInit = {}) {
  const controller = new AbortController();
  const timeout = globalThis.setTimeout(() => controller.abort(), PROVIDER_REQUEST_TIMEOUT_MS);
  try {
    return await fetch(input, { ...init, signal: controller.signal });
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") {
      throw new Error("Provider တောင်းဆိုမှု အချိန်ကြာမြင့်သွားသောကြောင့် ရပ်လိုက်ပါသည်။");
    }
    throw error;
  } finally {
    globalThis.clearTimeout(timeout);
  }
}

async function callGemini(
  input: Parameters<CopyEditingProvider["analyze"]>[0],
  config: ProviderConfig,
) {
  const response = await fetchWithTimeout(
    `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(config.model)}:generateContent?key=${encodeURIComponent(config.apiKey)}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: buildPrompt(input) }] }],
        generationConfig: { responseMimeType: "application/json" },
      }),
    },
  );
  if (!response.ok) throw new Error("Gemini API သို့ ချိတ်ဆက်၍ မရပါ။ API key နှင့် model ကို စစ်ဆေးပါ။");
  const data = await response.json();
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) throw new Error("Gemini API မှ ရလဒ်မရရှိပါ။");
  return parseProviderResult(text, input.targetStyle);
}

async function callCustom(
  input: Parameters<CopyEditingProvider["analyze"]>[0],
  config: ProviderConfig,
) {
  if (!config.endpoint) throw new Error("Custom API endpoint ကို ထည့်ပေးပါ။");
  const response = await fetchWithTimeout(config.endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${config.apiKey}` },
    body: JSON.stringify({
      model: config.model,
      temperature: 0.1,
      messages: [
        {
          role: "system",
          content:
            "You are a careful Myanmar copy editor. Return valid JSON only. All summaries, explanations, and policy notes must be Burmese Unicode only; do not write English in remarks or notes.",
        },
        { role: "user", content: buildPrompt(input) },
      ],
    }),
  });
  if (!response.ok) throw new Error("Custom API သို့ ချိတ်ဆက်၍ မရပါ။ endpoint နှင့် API key ကို စစ်ဆေးပါ။");
  const data = await response.json();
  const content = data.choices?.[0]?.message?.content;
  const text = Array.isArray(content)
    ? content.map((part: { text?: string }) => part.text ?? "").join("")
    : content;
  if (!text) throw new Error("Custom API မှ ရလဒ်မရရှိပါ။");
  return parseProviderResult(text, input.targetStyle);
}

async function callProxy(
  input: Parameters<CopyEditingProvider["analyze"]>[0],
  config: ProviderConfig,
) {
  const response = await fetchWithTimeout(`${providerProxyUrl.replace(/\/$/u, "")}/api/proofread`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      sourceText: input.sourceText,
      targetStyle: input.targetStyle,
      activePolicies: input.activePolicies,
      spellingReference: getSpellingReference(input.sourceText),
      provider: { kind: config.kind, model: config.model },
    }),
  });
  const data = (await response.json().catch(() => null)) as {
    text?: unknown;
    error?: unknown;
  } | null;
  if (!response.ok) {
    throw new Error(typeof data?.error === "string" ? data.error : "Provider proxy သို့ ချိတ်ဆက်၍ မရပါ။");
  }
  if (typeof data?.text !== "string" || !data.text.trim()) {
    throw new Error("Provider proxy မှ ရလဒ်မရရှိပါ။");
  }
  return parseProviderResult(data.text, input.targetStyle);
}

export async function analyzeWithConfiguredProvider(
  input: Parameters<CopyEditingProvider["analyze"]>[0],
) {
  const config = getProviderConfig();
  if (!isProviderProxyEnabled() && !config.apiKey.trim())
    throw new Error("API key မထည့်ရသေးပါ။ Settings ထဲတွင် Gemini သို့မဟုတ် Custom API key ထည့်ပါ။");
  try {
    return isProviderProxyEnabled()
      ? await callProxy(input, config)
      : config.kind === "GEMINI"
        ? await callGemini(input, config)
        : await callCustom(input, config);
  } catch (error) {
    if (error instanceof TypeError)
      throw new Error(
        "Provider API ကို မချိတ်ဆက်နိုင်ပါ။ API endpoint ၏ CORS နှင့် network setting ကို စစ်ဆေးပါ။",
      );
    throw error instanceof Error ? error : new Error("ဝန်ဆောင်မှုပေးသူ လုပ်ဆောင်မှု မအောင်မြင်ပါ။");
  }
}
