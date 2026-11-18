import { createServer } from "node:http";
import { readFileSync } from "node:fs";

function loadEnvFile() {
  try {
    const contents = readFileSync(new URL("../private/.env", import.meta.url), "utf8");
    for (const line of contents.split(/\r?\n/u)) {
      const match = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/u);
      if (!match || process.env[match[1]] !== undefined) continue;
      process.env[match[1]] = match[2].trim().replace(/^['"]|['"]$/gu, "");
    }
  } catch {
    /* Environment variables may be supplied by the process manager. */
  }
}

loadEnvFile();

const PORT = Number(process.env.PROXY_PORT || 8787);
const MAX_SOURCE_CHARACTERS = 50_000;
const MAX_BODY_BYTES = 512 * 1024;
const RATE_LIMIT_WINDOW_MS = 60_000;
const RATE_LIMIT_MAX_REQUESTS = 30;
const PROVIDER_TIMEOUT_MS = 30_000;
const rateLimit = new Map();

class ClientInputError extends Error {
  statusCode = 400;
}

function json(res, status, body, origin) {
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
  });
  res.end(JSON.stringify(body));
}

function allowedOrigin(requestOrigin) {
  const configured = (process.env.ALLOWED_ORIGIN || "http://localhost:5173").trim();
  return requestOrigin && requestOrigin === configured ? requestOrigin : configured;
}

function clientAddress(request) {
  return (
    request.headers["x-forwarded-for"]?.split(",")[0]?.trim() ||
    request.socket.remoteAddress ||
    "unknown"
  );
}

function withinRateLimit(address) {
  const now = Date.now();
  for (const [key, value] of rateLimit) {
    if (now - value.startedAt >= RATE_LIMIT_WINDOW_MS) rateLimit.delete(key);
  }
  const current = rateLimit.get(address);
  if (!current || now - current.startedAt >= RATE_LIMIT_WINDOW_MS) {
    rateLimit.set(address, { startedAt: now, count: 1 });
    return true;
  }
  if (current.count >= RATE_LIMIT_MAX_REQUESTS) return false;
  current.count += 1;
  return true;
}

async function readJson(request) {
  const chunks = [];
  let size = 0;
  for await (const chunk of request) {
    size += chunk.length;
    if (size > MAX_BODY_BYTES) throw new Error("PAYLOAD_TOO_LARGE");
    chunks.push(chunk);
  }
  try {
    return JSON.parse(Buffer.concat(chunks).toString("utf8"));
  } catch {
    throw new Error("INVALID_JSON");
  }
}

function requestText(body) {
  if (
    !body ||
    typeof body !== "object" ||
    typeof body.sourceText !== "string" ||
    !body.sourceText.trim()
  ) {
    throw new ClientInputError("စာသား မထည့်ရသေးပါ။");
  }
  if (body.sourceText.length > MAX_SOURCE_CHARACTERS) {
    throw new ClientInputError("စာသားအရှည်သည် စာလုံး ၅၀,၀၀၀ ထက် မကျော်ရပါ။");
  }
  return body.sourceText;
}

function requestStyle(body) {
  if (
    !body ||
    typeof body !== "object" ||
    (body.targetStyle !== "SPOKEN" && body.targetStyle !== "WRITTEN")
  ) {
    throw new ClientInputError("ရေးဟန်ကို ရွေးချယ်ပေးပါ။");
  }
  return body.targetStyle;
}

function requestProvider(body) {
  const provider =
    body && typeof body === "object" && body.provider && typeof body.provider === "object"
      ? body.provider
      : {};
  const kind = provider.kind === "CUSTOM" ? "CUSTOM" : "GEMINI";
  const model =
    typeof provider.model === "string" && provider.model.trim() ? provider.model.trim() : "";
  if (model.length > 120) throw new ClientInputError("Model အမည် မမှန်ကန်ပါ။");
  return { kind, model };
}

function requestSpellingReference(body) {
  return body && Array.isArray(body.spellingReference)
    ? body.spellingReference
        .filter((term) => typeof term === "string" && term.trim())
        .map((term) => term.trim().slice(0, 300))
        .slice(0, 80)
    : [];
}

function buildPrompt({ sourceText, targetStyle, activePolicies, spellingReference }) {
  const policies =
    activePolicies.length === 0
      ? "None"
      : activePolicies.map((policy) => `- ${policy.ruleText}`).join("\n");
  const spellingReferenceText =
    spellingReference.length === 0
      ? "No exact reference entry was found."
      : spellingReference.map((term) => `- ${term}`).join("\n");
  return `Edit this Myanmar text for ${targetStyle === "SPOKEN" ? "natural spoken" : "written/literary"} style. Preserve meaning. Apply these house policies when relevant:\n${policies}\n\nReturn JSON only with this shape: {"targetStyle":"SPOKEN|WRITTEN","sentenceStructureSummary":"string","structureIssues":[{"original":"string","suggestion":"string","explanation":"string"}],"correctedText":"string","spellingNotes":[{"original":"string","suggestion":"string","explanation":"string"}],"grammarNotes":[{"original":"string","suggestion":"string","explanation":"string"}],"policyNotes":["string"]}\n\nImportant: correctedText must preserve Burmese meaning. All summaries, explanations, and policyNotes values must be Burmese Unicode only. Do not write English in remarks or notes.\n\nThe supplied spelling lexicon is a user-provided reference list, not a complete authority. Use matching entries as spelling evidence and preserve their contextual parenthetical glosses when relevant. Do not mark a word as wrong only because it is absent from this list.\n\nRelevant spelling reference entries:\n${spellingReferenceText}\n\nSource text:\n${sourceText}`;
}

function customContentText(content) {
  if (typeof content === "string") return content;
  if (!Array.isArray(content)) return "";
  return content.map((part) => (part && typeof part.text === "string" ? part.text : "")).join("");
}

async function providerFetch(input, init) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), PROVIDER_TIMEOUT_MS);
  try {
    return await fetch(input, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timeout);
  }
}

async function providerText(body) {
  const sourceText = requestText(body);
  const targetStyle = requestStyle(body);
  const provider = requestProvider(body);
  const activePolicies = Array.isArray(body.activePolicies)
    ? body.activePolicies
        .filter((policy) => policy && typeof policy.ruleText === "string")
        .slice(0, 100)
    : [];
  const spellingReference = requestSpellingReference(body);
  const prompt = buildPrompt({ sourceText, targetStyle, activePolicies, spellingReference });

  if (provider.kind === "GEMINI") {
    const apiKey = (process.env.GEMINI_API_KEY || "").trim();
    if (!apiKey) throw new Error("Server တွင် Gemini API key မသတ်မှတ်ရသေးပါ။");
    const model = provider.model || process.env.GEMINI_MODEL || "gemini-3.8-flash";
    const response = await providerFetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(apiKey)}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { responseMimeType: "application/json" },
        }),
      },
    );
    if (!response.ok) throw new Error("Gemini provider request failed.");
    const data = await response.json();
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
    if (typeof text !== "string" || !text.trim())
      throw new Error("Gemini provider returned no result.");
    return text;
  }

  const apiKey = (process.env.CUSTOM_API_KEY || "").trim();
  const endpoint = (process.env.CUSTOM_ENDPOINT || "").trim();
  if (!apiKey || !endpoint) throw new Error("Server တွင် Custom provider setting မပြည့်စုံပါ။");
  const model = provider.model || process.env.CUSTOM_MODEL || "";
  const response = await providerFetch(endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({
      model,
      temperature: 0.1,
      messages: [
        {
          role: "system",
          content:
            "You are a careful Myanmar copy editor. Return valid JSON only. All summaries, explanations, and policy notes must be Burmese Unicode only; do not write English in remarks or notes.",
        },
        { role: "user", content: prompt },
      ],
    }),
  });
  if (!response.ok) throw new Error("Custom provider request failed.");
  const data = await response.json();
  const text = customContentText(data.choices?.[0]?.message?.content);
  if (!text.trim()) throw new Error("Custom provider returned no result.");
  return text;
}

const server = createServer(async (request, response) => {
  const requestOrigin = request.headers.origin;
  const origin = allowedOrigin(requestOrigin);
  if (requestOrigin && requestOrigin !== origin) {
    json(response, 403, { error: "Origin ကို ခွင့်မပြုပါ။" }, origin);
    return;
  }
  if (request.method === "OPTIONS") {
    json(response, 204, {}, origin);
    return;
  }
  if (request.method !== "POST" || request.url !== "/api/proofread") {
    json(response, 404, { error: "Not found." }, origin);
    return;
  }
  if (!withinRateLimit(clientAddress(request))) {
    json(response, 429, { error: "တောင်းဆိုမှုများလွန်းပါသည်။ ခဏစောင့်ပြီး ပြန်ကြိုးစားပါ။" }, origin);
    return;
  }
  try {
    const body = await readJson(request);
    const text = await providerText(body);
    json(response, 200, { text }, origin);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Provider proxy request failed.";
    const status =
      error instanceof ClientInputError
        ? error.statusCode
        : message === "PAYLOAD_TOO_LARGE"
          ? 413
          : message === "INVALID_JSON"
            ? 400
            : 502;
    json(
      response,
      status,
      { error: status === 502 ? "Provider request မအောင်မြင်ပါ။" : message },
      origin,
    );
  }
});

server.listen(PORT, () => {
  console.log(`Provider proxy listening on http://localhost:${PORT}`);
});
