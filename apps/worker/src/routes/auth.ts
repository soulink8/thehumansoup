/**
 * Authentication routes
 *
 * POST /auth/request - Request a 6-digit code
 * POST /auth/verify - Verify code and get JWT
 * POST /auth/me3 - Link a me3 token and get JWT
 * GET /auth/google/authorize - Initiate Google OAuth flow
 * GET /auth/google/callback - Handle Google OAuth callback
 * GET /auth/session - Get the current session user
 * POST /auth/logout - Clear the session cookie
 */

import { Hono } from "hono";
import { deleteCookie, getCookie, setCookie } from "hono/cookie";
import type { Env } from "../lib/types";
import { createJwt, generateCode, generateId, sha256 } from "../lib/crypto";
import { sendAuthCodeEmail } from "../lib/email";
import { fetchMe3Profile, normalizeUrl } from "../lib/me3";
import {
  clearSessionCookie,
  requireUser,
  SESSION_TTL_SECONDS,
  setSessionCookie,
} from "../lib/session";

const auth = new Hono<{ Bindings: Env }>();

const CODE_EXPIRATION_MS = 10 * 60 * 1000;
const MAX_ATTEMPTS = 5;
const GOOGLE_STATE_COOKIE = "soup_google_oauth_state";
const GOOGLE_STATE_TTL_SECONDS = 10 * 60;
const DEFAULT_WEB_ORIGIN = "http://localhost:5173";
const DEFAULT_REDIRECT_PATH = "/kitchen";
const GOOGLE_AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth";
const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";
const GOOGLE_USERINFO_URL = "https://www.googleapis.com/oauth2/v2/userinfo";

function parseOrigins(value?: string): string[] {
  if (!value) return [];
  return value
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);
}

function normalizeOrigin(origin: string): string {
  return origin.replace(/\/+$/, "");
}

function getFrontendOrigin(env: Env): string {
  const [origin] = parseOrigins(env.SOUP_WEB_ORIGINS);
  return normalizeOrigin(origin ?? DEFAULT_WEB_ORIGIN);
}

function sanitizeRedirect(redirect: string | null | undefined): string {
  if (!redirect || !redirect.startsWith("/") || redirect.startsWith("//")) {
    return DEFAULT_REDIRECT_PATH;
  }
  return redirect;
}

function getApiBaseFromRequest(requestUrl: string): string {
  const url = new URL(requestUrl);
  return `${url.protocol}//${url.host}`;
}

function oauthStateCookieOptions(requestUrl: string) {
  const isSecure = new URL(requestUrl).protocol === "https:";
  return {
    httpOnly: true,
    secure: isSecure,
    sameSite: "Lax",
    path: "/",
    maxAge: GOOGLE_STATE_TTL_SECONDS,
  } as const;
}

function requireEmailConfig(env: Env) {
  if (!env.POSTMARK_TOKEN || !env.POSTMARK_FROM_EMAIL) {
    return { ok: false, error: "Email is not configured" };
  }
  return { ok: true };
}

/**
 * Request an auth code
 * POST /auth/request
 * Body: { email: string }
 */
auth.post("/auth/request", async (c) => {
  const { email } = await c.req.json<{ email: string }>();

  if (!email || typeof email !== "string") {
    return c.json({ error: "Email is required" }, 400);
  }

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    return c.json({ error: "Invalid email format" }, 400);
  }

  const configCheck = requireEmailConfig(c.env);
  if (!configCheck.ok) {
    return c.json({ error: configCheck.error }, 500);
  }

  const normalizedEmail = email.toLowerCase().trim();
  const code = generateCode();
  const tokenHash = await sha256(code);
  const expiresAt = new Date(Date.now() + CODE_EXPIRATION_MS).toISOString();

  try {
    await c.env.DB.prepare(
      "DELETE FROM magic_tokens WHERE email = ? AND consumed_at IS NULL",
    )
      .bind(normalizedEmail)
      .run();

    await c.env.DB.prepare(
      `INSERT INTO magic_tokens (id, email, token_hash, expires_at, attempt_count, created_at)
       VALUES (?, ?, ?, ?, 0, datetime('now'))`,
    )
      .bind(generateId(), normalizedEmail, tokenHash, expiresAt)
      .run();

    const emailSent = await sendAuthCodeEmail(
      {
        postmarkToken: c.env.POSTMARK_TOKEN,
        fromEmail: c.env.POSTMARK_FROM_EMAIL,
        messageStream: c.env.POSTMARK_STREAM,
      },
      normalizedEmail,
      code,
    );

    if (!emailSent) {
      console.error("Failed to send auth email to:", normalizedEmail);
    }

    return c.json({ ok: true });
  } catch (error) {
    console.error("Auth request error:", error);
    return c.json({ error: "Something went wrong" }, 500);
  }
});

/**
 * Verify an auth code
 * POST /auth/verify
 * Body: { email: string, code: string }
 */
auth.post("/auth/verify", async (c) => {
  const { email, code } = await c.req.json<{ email: string; code: string }>();

  if (!email || !code) {
    return c.json({ error: "Email and code are required" }, 400);
  }

  const normalizedEmail = email.toLowerCase().trim();
  const tokenHash = await sha256(code);

  try {
    const token = await c.env.DB.prepare(
      `SELECT * FROM magic_tokens
       WHERE email = ? AND consumed_at IS NULL
       ORDER BY created_at DESC LIMIT 1`,
    )
      .bind(normalizedEmail)
      .first<{
        id: string;
        token_hash: string;
        expires_at: string;
        attempt_count: number;
      }>();

    if (!token) {
      return c.json({ error: "Invalid or expired code" }, 401);
    }

    if (new Date(token.expires_at) < new Date()) {
      return c.json({ error: "Code has expired" }, 401);
    }

    if (token.attempt_count >= MAX_ATTEMPTS) {
      return c.json({ error: "Too many attempts. Please request a new code." }, 401);
    }

    await c.env.DB.prepare(
      "UPDATE magic_tokens SET attempt_count = attempt_count + 1 WHERE id = ?",
    )
      .bind(token.id)
      .run();

    if (token.token_hash !== tokenHash) {
      return c.json({ error: "Invalid code" }, 401);
    }

    await c.env.DB.prepare(
      "UPDATE magic_tokens SET consumed_at = datetime('now') WHERE id = ?",
    )
      .bind(token.id)
      .run();

    let user = await c.env.DB.prepare(
      "SELECT * FROM soup_users WHERE email = ?",
    )
      .bind(normalizedEmail)
      .first<{ id: string; email: string; me3_site_url: string | null }>();

    if (!user) {
      const userId = generateId();
      await c.env.DB.prepare(
        `INSERT INTO soup_users (id, email, created_at, updated_at, last_login_at)
         VALUES (?, ?, datetime('now'), datetime('now'), datetime('now'))`,
      )
        .bind(userId, normalizedEmail)
        .run();

      user = { id: userId, email: normalizedEmail, me3_site_url: null };
    } else {
      await c.env.DB.prepare(
        "UPDATE soup_users SET updated_at = datetime('now'), last_login_at = datetime('now') WHERE id = ?",
      )
        .bind(user.id)
        .run();
    }

    if (!c.env.JWT_SECRET) {
      return c.json({ error: "JWT_SECRET is not configured" }, 500);
    }

    const jwt = await createJwt(
      { sub: user.id, email: user.email },
      c.env.JWT_SECRET,
      SESSION_TTL_SECONDS,
    );
    setSessionCookie(c, jwt);

    return c.json({
      token: jwt,
      user: {
        id: user.id,
        email: user.email,
        me3SiteUrl: user.me3_site_url ?? null,
      },
    });
  } catch (error) {
    console.error("Auth verify error:", error);
    return c.json({ error: "Something went wrong" }, 500);
  }
});

/**
 * Link a me3 token and return a JWT
 * POST /auth/me3
 * Body: { siteUrl: string, token: string }
 */
auth.post("/auth/me3", async (c) => {
  const { siteUrl, token } = await c.req.json<{ siteUrl: string; token: string }>();

  if (!siteUrl || !token) {
    return c.json({ error: "siteUrl and token are required" }, 400);
  }

  if (token.trim().length < 12) {
    return c.json({ error: "Token looks too short" }, 400);
  }

  const normalizedSiteUrl = normalizeUrl(siteUrl);
  const profileResult = await fetchMe3Profile(normalizedSiteUrl);
  if (!profileResult.success || !profileResult.profile) {
    return c.json({ error: profileResult.error ?? "Failed to fetch me.json" }, 400);
  }

  const tokenHash = await sha256(token.trim());
  const handle = profileResult.profile.handle ?? null;
  const displayName = profileResult.profile.name ?? handle;

  try {
    let user = await c.env.DB.prepare(
      "SELECT * FROM soup_users WHERE me3_site_url = ?",
    )
      .bind(normalizedSiteUrl)
      .first<{ id: string; email: string | null; me3_site_url: string | null }>();

    if (!user) {
      const userId = generateId();
      await c.env.DB.prepare(
        `INSERT INTO soup_users (id, email, me3_site_url, me3_token_hash, created_at, updated_at, last_login_at)
         VALUES (?, ?, ?, ?, datetime('now'), datetime('now'), datetime('now'))`,
      )
        .bind(userId, null, normalizedSiteUrl, tokenHash)
        .run();

      user = { id: userId, email: null, me3_site_url: normalizedSiteUrl };
    } else {
      await c.env.DB.prepare(
        `UPDATE soup_users
         SET me3_token_hash = ?, updated_at = datetime('now'), last_login_at = datetime('now')
         WHERE id = ?`,
      )
        .bind(tokenHash, user.id)
        .run();
    }

    if (!c.env.JWT_SECRET) {
      return c.json({ error: "JWT_SECRET is not configured" }, 500);
    }

    const jwt = await createJwt(
      {
        sub: user.id,
        me3SiteUrl: normalizedSiteUrl,
        handle,
        displayName,
      },
      c.env.JWT_SECRET,
      SESSION_TTL_SECONDS,
    );
    setSessionCookie(c, jwt);

    return c.json({
      token: jwt,
      user: {
        id: user.id,
        email: user.email,
        me3SiteUrl: normalizedSiteUrl,
      },
      me3Profile: {
        handle,
        displayName,
      },
    });
  } catch (error) {
    console.error("Auth me3 error:", error);
    return c.json({ error: "Something went wrong" }, 500);
  }
});

/**
 * Start Google OAuth flow
 * GET /auth/google/authorize
 */
auth.get("/auth/google/authorize", async (c) => {
  const frontendOrigin = getFrontendOrigin(c.env);

  if (!c.env.GOOGLE_CLIENT_ID || !c.env.GOOGLE_CLIENT_SECRET) {
    return c.redirect(`${frontendOrigin}/login?error=oauth_not_configured`);
  }

  const redirectPath = sanitizeRedirect(c.req.query("redirect"));
  const state = generateId();
  const statePayload = `${state}:${encodeURIComponent(redirectPath)}`;

  setCookie(c, GOOGLE_STATE_COOKIE, statePayload, oauthStateCookieOptions(c.req.url));

  const redirectUri = `${getApiBaseFromRequest(c.req.url)}/auth/google/callback`;
  const params = new URLSearchParams({
    client_id: c.env.GOOGLE_CLIENT_ID,
    redirect_uri: redirectUri,
    response_type: "code",
    scope: "openid email profile",
    state,
    prompt: "select_account",
  });

  return c.redirect(`${GOOGLE_AUTH_URL}?${params.toString()}`);
});

/**
 * Handle Google OAuth callback
 * GET /auth/google/callback
 */
auth.get("/auth/google/callback", async (c) => {
  const frontendOrigin = getFrontendOrigin(c.env);
  const redirectToLoginError = (errorCode: string) =>
    c.redirect(`${frontendOrigin}/login?error=${encodeURIComponent(errorCode)}`);

  if (c.req.query("error")) {
    return redirectToLoginError("oauth_denied");
  }

  const code = c.req.query("code");
  const state = c.req.query("state");
  const statePayload = getCookie(c, GOOGLE_STATE_COOKIE);

  const stateCookieOptions = oauthStateCookieOptions(c.req.url);
  deleteCookie(c, GOOGLE_STATE_COOKIE, {
    path: stateCookieOptions.path,
    secure: stateCookieOptions.secure,
    sameSite: stateCookieOptions.sameSite,
  });

  if (!code || !state || !statePayload) {
    return redirectToLoginError("missing_params");
  }

  const separatorIndex = statePayload.indexOf(":");
  if (separatorIndex <= 0) {
    return redirectToLoginError("invalid_state");
  }

  const expectedState = statePayload.slice(0, separatorIndex);
  if (state !== expectedState) {
    return redirectToLoginError("invalid_state");
  }

  let redirectPath = DEFAULT_REDIRECT_PATH;
  try {
    redirectPath = sanitizeRedirect(
      decodeURIComponent(statePayload.slice(separatorIndex + 1)),
    );
  } catch {
    return redirectToLoginError("invalid_state");
  }

  if (!c.env.GOOGLE_CLIENT_ID || !c.env.GOOGLE_CLIENT_SECRET) {
    return redirectToLoginError("oauth_not_configured");
  }

  const redirectUri = `${getApiBaseFromRequest(c.req.url)}/auth/google/callback`;

  let accessToken: string | null = null;
  try {
    const tokenResponse = await fetch(GOOGLE_TOKEN_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code,
        client_id: c.env.GOOGLE_CLIENT_ID,
        client_secret: c.env.GOOGLE_CLIENT_SECRET,
        redirect_uri: redirectUri,
        grant_type: "authorization_code",
      }).toString(),
    });

    if (!tokenResponse.ok) {
      console.error(
        "Google token exchange failed:",
        tokenResponse.status,
        await tokenResponse.text(),
      );
      return redirectToLoginError("token_exchange_failed");
    }

    const tokenData = (await tokenResponse.json()) as {
      access_token?: string;
    };
    accessToken = tokenData.access_token ?? null;
  } catch (error) {
    console.error("Google token exchange threw:", error);
    return redirectToLoginError("token_exchange_failed");
  }

  if (!accessToken) {
    return redirectToLoginError("token_exchange_failed");
  }

  type GoogleUserInfo = {
    id?: string;
    email?: string | null;
  };

  let userInfo: GoogleUserInfo | null = null;
  try {
    const profileResponse = await fetch(GOOGLE_USERINFO_URL, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Accept: "application/json",
      },
    });

    if (!profileResponse.ok) {
      console.error(
        "Google userinfo failed:",
        profileResponse.status,
        await profileResponse.text(),
      );
      return redirectToLoginError("user_info_failed");
    }

    userInfo = (await profileResponse.json()) as GoogleUserInfo;
  } catch (error) {
    console.error("Google userinfo threw:", error);
    return redirectToLoginError("user_info_failed");
  }

  if (!userInfo?.id) {
    return redirectToLoginError("user_info_failed");
  }

  const normalizedEmail =
    typeof userInfo.email === "string" && userInfo.email.trim()
      ? userInfo.email.toLowerCase().trim()
      : `google_${userInfo.id}@oauth.thehumansoup.ai`;

  try {
    let user = await c.env.DB.prepare(
      "SELECT id, email, me3_site_url FROM soup_users WHERE email = ?",
    )
      .bind(normalizedEmail)
      .first<{ id: string; email: string | null; me3_site_url: string | null }>();

    if (!user) {
      const userId = generateId();
      await c.env.DB.prepare(
        `INSERT INTO soup_users (id, email, created_at, updated_at, last_login_at)
         VALUES (?, ?, datetime('now'), datetime('now'), datetime('now'))`,
      )
        .bind(userId, normalizedEmail)
        .run();

      user = { id: userId, email: normalizedEmail, me3_site_url: null };
    } else {
      await c.env.DB.prepare(
        "UPDATE soup_users SET updated_at = datetime('now'), last_login_at = datetime('now') WHERE id = ?",
      )
        .bind(user.id)
        .run();
    }

    if (!c.env.JWT_SECRET) {
      return redirectToLoginError("database_error");
    }

    const jwt = await createJwt(
      { sub: user.id, email: user.email ?? normalizedEmail },
      c.env.JWT_SECRET,
      SESSION_TTL_SECONDS,
    );
    setSessionCookie(c, jwt);

    return c.redirect(`${frontendOrigin}${redirectPath}`);
  } catch (error) {
    console.error("Google OAuth database error:", error);
    return redirectToLoginError("database_error");
  }
});

/**
 * Get the current session user
 * GET /auth/session
 */
auth.get("/auth/session", async (c) => {
  const session = await requireUser(c);
  if (!session.ok) {
    return c.json({ error: session.error }, session.status);
  }

  return c.json({
    user: {
      id: session.userId,
      email: session.email,
      me3SiteUrl: session.me3SiteUrl,
      handle: session.handle ?? null,
      displayName: session.displayName ?? null,
    },
  });
});

/**
 * Clear the session cookie
 * POST /auth/logout
 */
auth.post("/auth/logout", async (c) => {
  clearSessionCookie(c);
  return c.json({ ok: true });
});

export default auth;
