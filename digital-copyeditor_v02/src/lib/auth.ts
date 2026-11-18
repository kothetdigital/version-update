export const AUTH_ENABLED = import.meta.env.VITE_AUTH_ENABLED === "true";

export type AuthUser = { id: string; email: string; displayName: string };
const userKey = "ko_thet_auth_user";

export function currentUser(): AuthUser | null {
  try {
    return JSON.parse(localStorage.getItem(userKey) ?? "null") as AuthUser | null;
  } catch {
    return null;
  }
}

export async function login(email: string, password: string): Promise<AuthUser> {
  if (!email || password.length < 8) throw new Error("အီးမေးလ်နှင့် စကားဝှက်ကို မှန်ကန်စွာ ထည့်ပါ။");
  const user = { id: crypto.randomUUID(), email, displayName: email.split("@")[0] };
  localStorage.setItem(userKey, JSON.stringify(user));
  return user;
}

export async function register(
  email: string,
  displayName: string,
  password: string,
): Promise<AuthUser> {
  if (!displayName.trim() || password.length < 8) throw new Error("အမည်နှင့် စကားဝှက်ကို မှန်ကန်စွာ ထည့်ပါ။");
  return login(email, password).then((user) => ({ ...user, displayName }));
}

export function logout() {
  localStorage.removeItem(userKey);
}
