import type { EditingSession, HousePolicy } from "./types";

const keys = {
  draft: "ko_thet_editor_draft",
  policies: "ko_thet_editor_policies",
  history: "ko_thet_editor_history",
  theme: "ko_thet_editor_theme",
} as const;

function storage(): Storage | null {
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

function read<T>(key: string, fallback: T): T {
  try {
    const value = storage()?.getItem(key);
    return value ? (JSON.parse(value) as T) : fallback;
  } catch {
    return fallback;
  }
}

function write<T>(key: string, value: T) {
  try {
    storage()?.setItem(key, JSON.stringify(value));
  } catch {
    /* Storage is optional in private/restricted browsers. */
  }
}

const defaultDraft = "မနက်ဖြန် ခရီးသွားမယ် ပိုက်ဆံလိုတယ်။";
const isPolicy = (value: unknown): value is HousePolicy =>
  Boolean(
    value &&
    typeof value === "object" &&
    typeof (value as HousePolicy).id === "string" &&
    typeof (value as HousePolicy).ruleText === "string" &&
    typeof (value as HousePolicy).isActive === "boolean",
  );
const isSession = (value: unknown): value is EditingSession =>
  Boolean(
    value &&
    typeof value === "object" &&
    typeof (value as EditingSession).id === "string" &&
    typeof (value as EditingSession).sourceText === "string" &&
    (value as EditingSession).result != null,
  );

export function getDraft() {
  try {
    return storage()?.getItem(keys.draft) ?? defaultDraft;
  } catch {
    return defaultDraft;
  }
}
export function saveDraft(value: string) {
  try {
    storage()?.setItem(keys.draft, value);
  } catch {
    /* Ignore unavailable storage. */
  }
}
export function getPolicies(): HousePolicy[] {
  const value = read<unknown>(keys.policies, []);
  return Array.isArray(value) ? value.filter(isPolicy) : [];
}
export function savePolicies(value: HousePolicy[]) {
  write(keys.policies, value);
}
export function getHistory(): EditingSession[] {
  const value = read<unknown>(keys.history, []);
  return Array.isArray(value) ? value.filter(isSession) : [];
}
export function saveHistory(value: EditingSession[]) {
  write(keys.history, value);
}
export function getTheme(): "light" | "dark" {
  try {
    return storage()?.getItem(keys.theme) === "dark" ? "dark" : "light";
  } catch {
    return "light";
  }
}
export function saveTheme(value: "light" | "dark") {
  try {
    storage()?.setItem(keys.theme, value);
  } catch {
    /* Ignore unavailable storage. */
  }
}
export function clearLocalData() {
  try {
    Object.values(keys).forEach((key) => storage()?.removeItem(key));
  } catch {
    /* Ignore unavailable storage. */
  }
}
