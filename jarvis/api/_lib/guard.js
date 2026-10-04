// Shared request guard for the API routes.
// Files/folders starting with "_" inside /api are NOT deployed as separate Vercel functions.
import { createHash, timingSafeEqual } from "node:crypto";

const buckets = new Map();

export function cleanKey(value) {
  return typeof value === "string" ? value.trim().replace(/^(['"])(.*)\1$/, "$2") : "";
}

/** Coerce to a string, strip control characters, and cap the length. */
export function str(value, max) {
  if (typeof value !== "string") return "";
  // eslint-disable-next-line no-control-regex
  return value.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, "").slice(0, max);
}

export function safeUrl(value) {
  try {
    const u = new URL(String(value));
    return u.protocol === "https:" || u.protocol === "http:" ? u.toString().slice(0, 2000) : "";
  } catch {
    return "";
  }
}

function clientIp(req) {
  const fwd = req.headers["x-forwarded-for"];
  const first = (Array.isArray(fwd) ? fwd[0] : fwd || "").split(",")[0].trim();
  return first || req.headers["x-real-ip"] || req.socket?.remoteAddress || "unknown";
}

function hit(key, limit, windowMs) {
  const now = Date.now();
  if (buckets.size > 5000) for (const [k, b] of buckets) if (b.reset < now) buckets.delete(k);
  let b = buckets.get(key);
  if (!b || b.reset < now) {
    b = { count: 0, reset: now + windowMs };
    buckets.set(key, b);
  }
  b.count += 1;
  return { ok: b.count <= limit, retryAfter: Math.max(1, Math.ceil((b.reset - now) / 1000)) };
}

function sameOrigin(req) {
  const origin = req.headers.origin;
  const host = req.headers.host;
  if (origin) {
    try {
      const o = new URL(origin);
      if (o.host === host) return true;
      const allowed = (process.env.ALLOWED_ORIGINS || "").split(",").map((s) => s.trim()).filter(Boolean);
      return allowed.includes(o.origin);
    } catch {
      return false;
    }
  }
  const site = req.headers["sec-fetch-site"];
  return site === "same-origin" || site === "none";
}

function accessOk(req) {
  const expected = cleanKey(process.env.ACCESS_CODE);
  if (!expected) return true; // gate disabled
  const given = req.headers["x-access-code"];
  if (typeof given !== "string") return false;
  const a = createHash("sha256").update(given.trim()).digest();
  const b = createHash("sha256").update(expected).digest();
  return timingSafeEqual(a, b);
}

/**
 * Runs method, origin, rate-limit and access-code checks.
 * Returns the parsed JSON body (an object) when allowed, or null after sending a response.
 *
 * NOTE: the in-memory rate limiter is per serverless instance (best effort). For hard limits
 * also add a Vercel Firewall rate-limit rule on /api/*.
 */
export function guard(req, res, name) {
  res.setHeader("Cache-Control", "no-store");
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    res.status(405).json({ error: "Method not allowed." });
    return null;
  }
  if (!sameOrigin(req)) {
    res.status(403).json({ error: "Forbidden." });
    return null;
  }
  const ip = clientIp(req);
  const limit = Number(process.env.RATE_LIMIT_PER_MIN) || 20;
  const rl = hit(`${name}:${ip}`, limit, 60_000);
  if (!rl.ok) {
    res.setHeader("Retry-After", String(rl.retryAfter));
    res.status(429).json({ error: "Too many requests. Please wait a moment and try again." });
    return null;
  }
  if (!accessOk(req)) {
    const bad = hit(`auth:${ip}`, 10, 10 * 60_000); // throttle code guessing
    if (!bad.ok) {
      res.setHeader("Retry-After", String(bad.retryAfter));
      res.status(429).json({ error: "Too many failed attempts. Try again later." });
      return null;
    }
    res.status(401).json({ error: "Access code required.", code: "ACCESS_REQUIRED" });
    return null;
  }
  let body = req.body;
  if (typeof body === "string") {
    try { body = JSON.parse(body); } catch { body = null; }
  }
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    res.status(400).json({ error: "Invalid request body." });
    return null;
  }
  return body;
}
