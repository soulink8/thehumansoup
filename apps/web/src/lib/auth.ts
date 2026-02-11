export type AuthUser = {
  id?: string;
  email?: string | null;
  me3SiteUrl?: string | null;
  handle?: string | null;
  displayName?: string | null;
};

const LEGACY_TOKEN_KEY = "soup_auth_token";
const USER_KEY = "soup_auth_user";

function purgeLegacyTokenStorage(): void {
  try {
    if (typeof localStorage === "undefined") return;
    localStorage.removeItem(LEGACY_TOKEN_KEY);
  } catch {
    // ignore storage access errors (privacy mode, blocked storage, etc.)
  }
}

purgeLegacyTokenStorage();

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
  clearAuthUser();
}

export async function fetchAuthSession(apiBase: string): Promise<AuthUser | null> {
  try {
    const response = await fetch(`${apiBase}/auth/session`, {
      credentials: "include",
    });

    if (response.status === 401) {
      clearAuthUser();
      return null;
    }

    if (!response.ok) {
      throw new Error(`Session request failed: ${response.status}`);
    }

    const data = (await response.json()) as { user?: AuthUser | null };
    const user = data.user ?? null;
    if (user) {
      setAuthUser(user);
    } else {
      clearAuthUser();
    }
    return user;
  } catch {
    return getAuthUser();
  }
}

export async function logout(apiBase: string): Promise<void> {
  try {
    await fetch(`${apiBase}/auth/logout`, {
      method: "POST",
      credentials: "include",
    });
  } finally {
    clearAuthUser();
  }
}
