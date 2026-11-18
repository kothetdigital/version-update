export type ProviderKind = "GEMINI" | "CUSTOM";

export type ProviderConfig = {
  kind: ProviderKind;
  apiKey: string;
  model: string;
  endpoint: string;
};

export const GEMINI_MODEL_OPTIONS = [
  { value: "gemini-3.8-flash", label: "Gemini 3.8 Flash", hint: "Recommended" },
  { value: "gemini-3.6-flash", label: "Gemini 3.6 Flash", hint: "Balanced" },
  { value: "gemini-3.5-flash-lite", label: "Gemini 3.5 Flash-Lite", hint: "Lower cost" },
  { value: "gemini-2.5-flash-lite", label: "Gemini 2.5 Flash-Lite", hint: "Lightweight" },
] as const;

export const providerProxyUrl = (import.meta.env.VITE_PROVIDER_PROXY_URL ?? "").trim();

export function isProviderProxyEnabled() {
  return Boolean(providerProxyUrl);
}

const storageKey = "ko_thet_editor_provider";
const defaultConfig: ProviderConfig = {
  kind: "GEMINI",
  apiKey: "",
  model: "gemini-3.8-flash",
  endpoint: "",
};

export function getProviderConfig(): ProviderConfig {
  try {
    const stored = JSON.parse(
      window.localStorage.getItem(storageKey) ?? "null",
    ) as Partial<ProviderConfig> | null;
    if (!stored || typeof stored !== "object" || Array.isArray(stored)) return { ...defaultConfig };
    const config: ProviderConfig = {
      ...defaultConfig,
      ...stored,
      apiKey: typeof stored.apiKey === "string" ? stored.apiKey : "",
      model: typeof stored.model === "string" ? stored.model : defaultConfig.model,
      endpoint: typeof stored.endpoint === "string" ? stored.endpoint : "",
      kind: stored.kind === "CUSTOM" ? "CUSTOM" : "GEMINI",
    };
    if (isProviderProxyEnabled()) {
      if (config.apiKey || config.endpoint) {
        try {
          window.localStorage.setItem(
            storageKey,
            JSON.stringify({ ...config, apiKey: "", endpoint: "" }),
          );
        } catch {
          /* Storage is optional in private/restricted browsers. */
        }
      }
      return { ...config, apiKey: "", endpoint: "" };
    }
    return config;
  } catch {
    return { ...defaultConfig };
  }
}

export function saveProviderConfig(config: ProviderConfig) {
  try {
    window.localStorage.setItem(
      storageKey,
      JSON.stringify({
        ...config,
        apiKey: isProviderProxyEnabled() ? "" : config.apiKey.trim(),
        model: config.model.trim(),
        endpoint: isProviderProxyEnabled() ? "" : config.endpoint.trim(),
      }),
    );
  } catch {
    /* Storage is optional in private/restricted browsers. */
  }
}
export function clearProviderConfig() {
  try {
    window.localStorage.removeItem(storageKey);
  } catch {
    /* Ignore unavailable storage. */
  }
}
export function providerLabel(config: ProviderConfig) {
  if (isProviderProxyEnabled()) return `${config.kind === "GEMINI" ? "Gemini" : "Custom"} proxy`;
  return config.apiKey.trim()
    ? config.kind === "GEMINI"
      ? "Gemini API"
      : "Custom API"
    : "Not configured";
}

export function providerReady(config: ProviderConfig) {
  if (isProviderProxyEnabled()) return Boolean(config.model.trim());
  return Boolean(config.apiKey.trim() && (config.kind === "GEMINI" || config.endpoint.trim()));
}
