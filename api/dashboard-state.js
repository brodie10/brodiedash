const { ensureSchema, query } = require("../lib/db");
const { getSessionFromRequest } = require("../lib/session");

module.exports = async function handler(req, res) {
  try {
    await ensureSchema();
    const session = getSessionFromRequest(req);
    if (!session) {
      res.status(401).json({ error: "Authentication is required." });
      return;
    }

    if (req.method === "GET") {
      await handleGet(res, session.username);
      return;
    }

    if (req.method === "PUT") {
      await handlePut(req, res, session.username);
      return;
    }

    res.setHeader("Allow", "GET, PUT");
    res.status(405).json({ error: "Method not allowed" });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

async function handleGet(res, username) {
  const result = await query(
    "SELECT payload, updated_at FROM brodiedash_dashboard_state WHERE username = $1",
    [username]
  );
  const row = result.rows[0];
  res.status(200).json({
    ok: true,
    exists: Boolean(row),
    payload: row?.payload || null,
    updatedAt: row?.updated_at || null
  });
}

async function handlePut(req, res, username) {
  const body = readJsonBody(req);
  const payload = normalizePayload(body.payload);
  const result = await query(
    `INSERT INTO brodiedash_dashboard_state (username, payload, updated_at)
     VALUES ($1, $2::jsonb, NOW())
     ON CONFLICT (username)
     DO UPDATE SET payload = EXCLUDED.payload, updated_at = NOW()
     RETURNING updated_at`,
    [username, JSON.stringify(payload)]
  );
  res.status(200).json({ ok: true, updatedAt: result.rows[0].updated_at });
}

function normalizePayload(payload) {
  return {
    tasks: Array.isArray(payload?.tasks) ? payload.tasks : []
  };
}

function readJsonBody(req) {
  if (typeof req.body === "string") return JSON.parse(req.body || "{}");
  return req.body || {};
}
