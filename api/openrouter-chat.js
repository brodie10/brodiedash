const ALLOWED_MODELS = new Set([
  "openai/gpt-5.5",
  "anthropic/claude-opus-4.8",
  "google/gemini-3.1-pro-preview"
]);

module.exports = async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  const key = process.env.OPENROUTER_API_KEY;
  if (!key) {
    res.status(500).json({ error: "OPENROUTER_API_KEY is not configured in Vercel." });
    return;
  }

  let body;
  try {
    body = typeof req.body === "string" ? JSON.parse(req.body || "{}") : req.body || {};
  } catch (error) {
    res.status(400).json({ error: "Request body must be valid JSON." });
    return;
  }
  if (!ALLOWED_MODELS.has(body.model)) {
    res.status(400).json({ error: "Model is not allowed for BrodieDash." });
    return;
  }
  if (!Array.isArray(body.messages)) {
    res.status(400).json({ error: "Messages must be an array." });
    return;
  }

  const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
      "HTTP-Referer": req.headers.origin || "https://brodiedash.vercel.app",
      "X-OpenRouter-Title": "BrodieDash"
    },
    body: JSON.stringify({
      model: body.model,
      messages: body.messages,
      temperature: Number.isFinite(body.temperature) ? body.temperature : 0.35
    })
  });

  const payload = await response.text();
  res.setHeader("Content-Type", response.headers.get("content-type") || "application/json");
  res.status(response.status).send(payload);
};
