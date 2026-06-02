const crypto = require("crypto");

const COOKIE_NAME = "brodiedash_session";
const SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 30;
const DEFAULT_SESSION_SECRET = "brodiedash-local-session-secret-change-in-vercel";

function getSessionSecret() {
  return process.env.BRODIEDASH_SESSION_SECRET
    || process.env.POSTGRES_URL
    || process.env.DATABASE_URL
    || DEFAULT_SESSION_SECRET;
}

function base64Url(input) {
  return Buffer.from(input).toString("base64url");
}

function sign(value) {
  return crypto
    .createHmac("sha256", getSessionSecret())
    .update(value)
    .digest("base64url");
}

function createSessionToken(user) {
  const payload = base64Url(JSON.stringify({
    username: user.username,
    role: user.role,
    exp: Math.floor(Date.now() / 1000) + SESSION_MAX_AGE_SECONDS
  }));
  return `${payload}.${sign(payload)}`;
}

function verifySessionToken(token) {
  if (!token || !token.includes(".")) return null;
  const [payload, signature] = token.split(".");
  if (!signature || sign(payload) !== signature) return null;
  try {
    const session = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
    if (!session.username || !session.role || session.exp < Math.floor(Date.now() / 1000)) return null;
    return session;
  } catch {
    return null;
  }
}

function getSessionFromRequest(req) {
  const cookies = parseCookies(req.headers.cookie || "");
  return verifySessionToken(cookies[COOKIE_NAME]);
}

function parseCookies(header) {
  return header.split(";").reduce((cookies, part) => {
    const [name, ...valueParts] = part.trim().split("=");
    if (!name) return cookies;
    cookies[name] = decodeURIComponent(valueParts.join("="));
    return cookies;
  }, {});
}

function getSessionCookie(user, req) {
  const secure = req.headers["x-forwarded-proto"] === "https" || req.headers.host?.includes("vercel.app");
  return [
    `${COOKIE_NAME}=${encodeURIComponent(createSessionToken(user))}`,
    "Path=/",
    "HttpOnly",
    "SameSite=Lax",
    `Max-Age=${SESSION_MAX_AGE_SECONDS}`,
    secure ? "Secure" : ""
  ].filter(Boolean).join("; ");
}

function getClearSessionCookie() {
  return `${COOKIE_NAME}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`;
}

module.exports = {
  getClearSessionCookie,
  getSessionCookie,
  getSessionFromRequest
};
