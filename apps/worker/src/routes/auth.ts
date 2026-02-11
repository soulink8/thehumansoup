/**
 * Authentication routes
 *
 * POST /auth/request - Request a 6-digit code
 * POST /auth/verify - Verify code and get JWT
 * POST /auth/me3 - Link a me3 token and get JWT
 */

import { Hono } from "hono";
import type { Env } from "../lib/types";
import { createJwt, generateCode, generateId, sha256 } from "../lib/crypto";
import { sendAuthCodeEmail } from "../lib/email";
import { fetchMe3Profile, normalizeUrl } from "../lib/me3";

const auth = new Hono<{ Bindings: Env }>();

const CODE_EXPIRATION_MS = 10 * 60 * 1000;
const MAX_ATTEMPTS = 5;

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
    );

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
      { sub: user.id, me3SiteUrl: normalizedSiteUrl },
      c.env.JWT_SECRET,
    );

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

export default auth;
