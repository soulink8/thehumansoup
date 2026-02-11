import type { Context } from "hono";
import { deleteCookie, getCookie, setCookie } from "hono/cookie";
import type { Env } from "./types";
import { verifyJwt } from "./crypto";

export type SessionUser = {
  userId: string;
  email: string | null;
  me3SiteUrl: string | null;
  handle?: string | null;
  displayName?: string | null;
};

export const SESSION_TTL_SECONDS = 7 * 24 * 60 * 60;
const SESSION_COOKIE = "soup_session";

function sessionCookieOptions(requestUrl: string) {
  const isSecure = new URL(requestUrl).protocol === "https:";
  return {
    httpOnly: true,
    secure: isSecure,
    sameSite: isSecure ? "None" : "Lax",
    path: "/",
    maxAge: SESSION_TTL_SECONDS,
  } as const;
}

type SessionContext = Context<{ Bindings: Env }>;

function readSessionToken(c: SessionContext) {
  const authHeader = c.req.header("authorization");
  const headerToken = authHeader?.replace(/^Bearer\s+/i, "");
  if (headerToken) return headerToken;
  return getCookie(c, SESSION_COOKIE) ?? null;
}

export function setSessionCookie(c: SessionContext, token: string): void {
  setCookie(c, SESSION_COOKIE, token, sessionCookieOptions(c.req.url));
}

export function clearSessionCookie(c: SessionContext): void {
  const options = sessionCookieOptions(c.req.url);
  deleteCookie(c, SESSION_COOKIE, {
    path: options.path,
    secure: options.secure,
    sameSite: options.sameSite,
  });
}

export async function requireUser(c: SessionContext): Promise<
  | { ok: false; error: string; status: 401 | 500 }
  | ({ ok: true } & SessionUser)
> {
  const token = readSessionToken(c);
  if (!token) {
    return { ok: false, error: "Missing auth token", status: 401 };
  }

  if (!c.env.JWT_SECRET) {
    return { ok: false, error: "JWT_SECRET is not configured", status: 500 };
  }

  const payload = await verifyJwt(token, c.env.JWT_SECRET);
  if (!payload || typeof payload.sub !== "string") {
    return { ok: false, error: "Invalid token", status: 401 };
  }

  return {
    ok: true,
    userId: payload.sub as string,
    email: typeof payload.email === "string" ? payload.email : null,
    me3SiteUrl: typeof payload.me3SiteUrl === "string" ? payload.me3SiteUrl : null,
    handle: typeof payload.handle === "string" ? payload.handle : null,
    displayName:
      typeof payload.displayName === "string" ? payload.displayName : null,
  };
}
