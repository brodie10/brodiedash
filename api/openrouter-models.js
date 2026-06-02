const ALLOWED_MODELS = [
  "openai/gpt-5.5",
  "anthropic/claude-opus-4.8",
  "google/gemini-3.1-pro-preview"
];

module.exports = async function handler(req, res) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  const key = process.env.OPENROUTER_API_KEY;
  if (!key) {
    res.status(500).json({ error: "OPENROUTER_API_KEY is not configured in Vercel." });
    return;
  }

  const response = await fetch("https://openrouter.ai/api/v1/models", {
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json"
    }
  });

  if (!response.ok) {
    const errorText = await response.text();
    res.status(response.status).json({ error: errorText.slice(0, 240) });
    return;
  }

  const payload = await response.json();
  const available = new Set((payload.data || []).map((model) => model.id).filter(Boolean));
  const models = ALLOWED_MODELS.filter((model) => available.has(model));
  res.status(200).json({
    data: (models.length ? models : ALLOWED_MODELS).map((id) => ({ id }))
  });
};
