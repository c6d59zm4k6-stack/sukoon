export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: "OPENROUTER_API_KEY is not configured." });
  }

  try {
    const { system, messages, model, max_tokens, plain_text, reasoning_effort } = req.body || {};

    if (!system || !Array.isArray(messages)) {
      return res.status(400).json({ error: "Invalid request." });
    }

    const openrouterResponse = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${apiKey}`,
        "HTTP-Referer": "https://your-vercel-app-url.vercel.app",
        "X-Title": "Sukoon"
      },
      body: JSON.stringify({
        model: model || "openai/gpt-oss-120b",
        messages: [
          { role: "system", content: system },
          ...messages.map(m => ({
            role: m.role === "assistant" ? "assistant" : "user",
            content: String(m.content || "")
          }))
        ],
        max_tokens: Math.min(Number(max_tokens) || 300, 800),
        temperature: 0.7,
        ...(plain_text ? {} : { response_format: { type: "json_object" } }),
        ...(reasoning_effort ? { reasoning: { effort: reasoning_effort } } : {})
      })
    });

    const data = await openrouterResponse.json();

    if (!openrouterResponse.ok) {
      console.error("OpenRouter API error:", data);
      const retryAfter = openrouterResponse.headers.get("retry-after");
      return res.status(openrouterResponse.status).json({
        error: data?.error?.message || "OpenRouter request failed.",
        retryAfter: retryAfter ? Number(retryAfter) : null
      });
    }

    const text = data?.choices?.[0]?.message?.content || "";
    return res.status(200).json({ text });
  } catch (error) {
    console.error("Server error:", error);
    return res.status(500).json({ error: "Unable to reach the AI service." });
  }
}
