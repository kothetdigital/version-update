export const MAX_SOURCE_CHARACTERS = 50_000;

export function limitSourceText(value: string) {
  return value.slice(0, MAX_SOURCE_CHARACTERS);
}

export const burmeseOnlyFallback = "ဤအချက်ကို မြန်မာဘာသာဖြင့် ရှင်းလင်းဖော်ပြထားသည်။";

export function burmeseOnly(value: unknown, fallback = burmeseOnlyFallback) {
  if (typeof value !== "string") return fallback;
  return /[\u1000-\u109f]/u.test(value) && !/[A-Za-z]/u.test(value) ? value : fallback;
}
