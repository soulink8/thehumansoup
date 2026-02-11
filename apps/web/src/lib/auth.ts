export type AuthUser = {
  id?: string;
  email?: string | null;
  me3SiteUrl?: string | null;
  handle?: string | null;
  displayName?: string | null;
};

const TOKEN_KEY = "soup_auth_token";
const USER_KEY = "soup_auth_user";
let inMemoryToken: string | null = null;

function purgeLegacyTokenStorage(): void {
  try {
    if (typeof localStorage === "undefined") return;
    localStorage.removeItem(TOKEN_KEY);
  } catch {
    // ignore storage access errors (privacy mode, blocked storage, etc.)
  }
}

purgeLegacyTokenStorage();

export function getAuthToken(): string | null {
  return inMemoryToken;
}

export function setAuthToken(token: string): void {
  inMemoryToken = token;
  purgeLegacyTokenStorage();
}

export function clearAuthToken(): void {
  inMemoryToken = null;
  purgeLegacyTokenStorage();
}

export function getAuthUser(): AuthUser | null {
  if (typeof localStorage === "undefined") return null;
  const raw = localStorage.getItem(USER_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as AuthUser;
  } catch {
    return null;
  }
}

export function setAuthUser(user: AuthUser): void {
  if (typeof localStorage === "undefined") return;
  localStorage.setItem(USER_KEY, JSON.stringify(user));
}

export function clearAuthUser(): void {
  if (typeof localStorage === "undefined") return;
  localStorage.removeItem(USER_KEY);
}

export function clearAuth(): void {
  clearAuthToken();
  clearAuthUser();
}
