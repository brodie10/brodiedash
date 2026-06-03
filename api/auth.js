const crypto = require("crypto");
const { ensureSchema, query } = require("../lib/db");
const { getClearSessionCookie, getSessionCookie, getSessionFromRequest } = require("../lib/session");

const DEFAULT_ADMIN = {
  username: "brodiebulman",
  password: "Brodie14!$"
};
const ALL_MODULE_PERMISSIONS = ["ai", "finance", "calendar", "roadmap", "systems", "admin"];
const DEFAULT_MODULE_PERMISSIONS = ["ai", "finance", "calendar", "roadmap", "systems"];

module.exports = async function handler(req, res) {
  try {
    await ensureSchema();

    if (req.method === "GET") {
      await handleStatus(req, res);
      return;
    }

    if (req.method !== "POST") {
      res.setHeader("Allow", "GET, POST");
      res.status(405).json({ error: "Method not allowed" });
      return;
    }

    const body = readJsonBody(req);
    const action = String(body.action || "").toLowerCase();
    if (action === "login") {
      await handleLogin(req, res, body);
      return;
    }
    if (action === "signup") {
      await handleSignup(res, body);
      return;
    }
    if (action === "logout") {
      res.setHeader("Set-Cookie", getClearSessionCookie());
      res.status(200).json({ ok: true });
      return;
    }
    if (action === "update-user") {
      await handleUpdateUser(req, res, body);
      return;
    }
    if (action === "update-profile") {
      await handleUpdateProfile(req, res, body);
      return;
    }

    res.status(400).json({ error: "Unsupported auth action." });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

async function handleStatus(req, res) {
  const session = getSessionFromRequest(req);
  if (!session) {
    res.status(200).json({ authenticated: false, available: true });
    return;
  }

  const user = await getUserByUsername(session.username);
  if (!user || user.status !== "approved") {
    res.setHeader("Set-Cookie", getClearSessionCookie());
    res.status(200).json({ authenticated: false, available: true });
    return;
  }

  const response = {
    authenticated: true,
    available: true,
    user: publicUser(user)
  };
  if (user.role === "admin") {
    response.users = await listUsers();
  }
  res.status(200).json(response);
}

async function handleLogin(req, res, body) {
  const username = normalizeUsername(body.username);
  const password = String(body.password || "");
  if (!username || !password) {
    res.status(400).json({ error: "Username and password are required." });
    return;
  }

  const adminUsername = normalizeUsername(process.env.BRODIEDASH_ADMIN_USERNAME || DEFAULT_ADMIN.username);
  if (username === adminUsername && password === getAdminPassword()) {
    const admin = await upsertAdmin(username, password);
    await recordLastLogin(admin.username);
    res.setHeader("Set-Cookie", getSessionCookie(admin, req));
    res.status(200).json({ ok: true, user: publicUser(admin), users: await listUsers() });
    return;
  }

  const user = await getUserByUsername(username);
  if (!user) {
    res.status(401).json({ error: "No approved account exists for that username." });
    return;
  }
  if (user.status === "pending") {
    res.status(403).json({ error: "That account is still waiting for Brodie approval." });
    return;
  }
  if (user.status === "denied") {
    res.status(403).json({ error: "That account request was denied." });
    return;
  }
  if (!verifyPassword(password, user.salt, user.password_hash)) {
    res.status(401).json({ error: "Incorrect password." });
    return;
  }

  await recordLastLogin(user.username);
  user.last_login_at = new Date().toISOString();
  res.setHeader("Set-Cookie", getSessionCookie(user, req));
  res.status(200).json({ ok: true, user: publicUser(user) });
}

async function handleSignup(res, body) {
  const username = normalizeUsername(body.username);
  const password = String(body.password || "");
  if (username.length < 3 || password.length < 6) {
    res.status(400).json({ error: "Use a username with 3+ characters and password with 6+ characters." });
    return;
  }
  if (username === normalizeUsername(process.env.BRODIEDASH_ADMIN_USERNAME || DEFAULT_ADMIN.username)) {
    res.status(400).json({ error: "That username is reserved." });
    return;
  }

  const existing = await getUserByUsername(username);
  if (existing) {
    res.status(409).json({
      error: existing.status === "approved"
        ? "That username is already approved."
        : "That username already has a request on file."
    });
    return;
  }

  const salt = crypto.randomBytes(16).toString("hex");
  await query(
    `INSERT INTO brodiedash_users (id, username, password_hash, salt, role, status, display_name, module_permissions)
     VALUES ($1, $2, $3, $4, 'user', 'pending', $5, $6::jsonb)`,
    [
      crypto.randomUUID(),
      username,
      hashPassword(password, salt),
      salt,
      cleanText(body.displayName || username, 80),
      JSON.stringify(DEFAULT_MODULE_PERMISSIONS)
    ]
  );
  res.status(201).json({ ok: true, message: "Request submitted. Brodie can approve it in the admin console." });
}

async function handleUpdateUser(req, res, body) {
  const session = getSessionFromRequest(req);
  if (!session || session.role !== "admin") {
    res.status(403).json({ error: "Admin access is required." });
    return;
  }

  const id = String(body.id || "");
  const status = String(body.status || "").toLowerCase();
  if (!id || !["approved", "denied", "pending"].includes(status)) {
    res.status(400).json({ error: "A valid user id and status are required." });
    return;
  }

  await query(
    `UPDATE brodiedash_users
     SET status = $1, reviewed_at = NOW(), reviewed_by = $2
     WHERE id = $3 AND role <> 'admin'`,
    [status, session.username, id]
  );
  res.status(200).json({ ok: true, users: await listUsers() });
}

async function handleUpdateProfile(req, res, body) {
  const session = getSessionFromRequest(req);
  if (!session || session.role !== "admin") {
    res.status(403).json({ error: "Admin access is required." });
    return;
  }

  const id = String(body.id || "");
  if (!id) {
    res.status(400).json({ error: "A valid user id is required." });
    return;
  }

  const role = normalizeProfileRole(body.role);
  const displayName = cleanText(body.displayName, 80);
  const notes = cleanText(body.notes, 800);
  const modulePermissions = normalizeModulePermissions(body.modulePermissions);

  await query(
    `UPDATE brodiedash_users
     SET role = $1, display_name = $2, notes = $3, module_permissions = $4::jsonb
     WHERE id = $5 AND role <> 'admin'`,
    [role, displayName, notes, JSON.stringify(modulePermissions), id]
  );
  res.status(200).json({ ok: true, users: await listUsers() });
}

async function upsertAdmin(username, password) {
  const salt = crypto.randomBytes(16).toString("hex");
  const result = await query(
    `INSERT INTO brodiedash_users (id, username, password_hash, salt, role, status, display_name, module_permissions)
     VALUES ($1, $2, $3, $4, 'admin', 'approved', 'Brodie Admin', $5::jsonb)
     ON CONFLICT (username)
     DO UPDATE SET password_hash = EXCLUDED.password_hash, salt = EXCLUDED.salt, role = 'admin', status = 'approved'
     RETURNING *`,
    [crypto.randomUUID(), username, hashPassword(password, salt), salt, JSON.stringify(ALL_MODULE_PERMISSIONS)]
  );
  return result.rows[0];
}

async function getUserByUsername(username) {
  const result = await query("SELECT * FROM brodiedash_users WHERE username = $1", [username]);
  return result.rows[0] || null;
}

async function listUsers() {
  const result = await query(
    `SELECT id, username, role, status, created_at, reviewed_at, reviewed_by,
       display_name, notes, module_permissions, last_login_at
     FROM brodiedash_users
     WHERE role <> 'admin'
     ORDER BY created_at DESC`
  );
  return result.rows.map(publicUser);
}

async function recordLastLogin(username) {
  await query("UPDATE brodiedash_users SET last_login_at = NOW() WHERE username = $1", [username]);
}

function getAdminPassword() {
  return process.env.BRODIEDASH_ADMIN_PASSWORD || DEFAULT_ADMIN.password;
}

function hashPassword(password, salt) {
  return crypto.scryptSync(password, salt, 64).toString("hex");
}

function verifyPassword(password, salt, expectedHash) {
  const actual = Buffer.from(hashPassword(password, salt), "hex");
  const expected = Buffer.from(expectedHash, "hex");
  return actual.length === expected.length && crypto.timingSafeEqual(actual, expected);
}

function normalizeUsername(value) {
  return String(value || "").trim().toLowerCase();
}

function normalizeProfileRole(value) {
  const role = String(value || "user").trim().toLowerCase();
  return ["user", "viewer", "editor"].includes(role) ? role : "user";
}

function cleanText(value, maxLength) {
  return String(value || "").trim().slice(0, maxLength);
}

function normalizeModulePermissions(value) {
  const input = Array.isArray(value) ? value : [];
  return ALL_MODULE_PERMISSIONS.filter((permission) => input.includes(permission));
}

function publicUser(user) {
  return {
    id: user.id,
    username: user.username,
    role: user.role,
    status: user.status,
    createdAt: user.created_at,
    reviewedAt: user.reviewed_at,
    reviewedBy: user.reviewed_by,
    displayName: user.display_name || user.username,
    notes: user.notes || "",
    modulePermissions: Array.isArray(user.module_permissions)
      ? user.module_permissions
      : DEFAULT_MODULE_PERMISSIONS,
    lastLoginAt: user.last_login_at
  };
}

function readJsonBody(req) {
  if (typeof req.body === "string") return JSON.parse(req.body || "{}");
  return req.body || {};
}
