export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: "GROQ_API_KEY is not configured." });
  }

  try {
    const { system, messages, model, max_tokens, response_schema, schema_name } = req.body || {};

    if (!system || !Array.isArray(messages)) {
      return res.status(400).json({ error: "Invalid request." });
    }

    // Prefer Groq's strict json_schema mode (constrained decoding — Groq's own docs
    // state this "never errors or produces invalid JSON") over the older, best-effort
    // json_object mode we were using before. json_object mode was the actual root
    // cause of the "Failed to generate JSON" 400s: it's only best-effort validation,
    // not token-level constrained generation. Falls back to json_object if a caller
    // doesn't supply a schema, so nothing breaks if a new call site is added later.
    const responseFormat = response_schema
      ? { type: "json_schema", json_schema: { name: schema_name || "response", strict: true, schema: response_schema } }
      : { type: "json_object" };

    const groqResponse = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${apiKey}`
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
        // Was: Math.min(Number(max_tokens) || 1000, 2000) — every call defaulted to
        // requesting up to 1000 output tokens even for a 10-token JSON classifier reply.
        // Front end now always sends an explicit, right-sized max_tokens; 300 is just a
        // safety-net default if it ever doesn't, and the ceiling is lowered to 800 since
        // no call in this app legitimately needs more than that.
        max_tokens: Math.min(Number(max_tokens) || 300, 800),
        temperature: 0.7,
        response_format: responseFormat,
        // gpt-oss models are reasoning models — by default they spend hidden
        // chain-of-thought tokens (medium effort) before the visible answer,
        // and those tokens count against max_tokens. Low effort is enough for
        // short, simple classification/reply tasks like this app's, and keeps
        // more of the budget for the actual answer.
        ...(String(model || "openai/gpt-oss-120b").includes("gpt-oss") ? { reasoning_effort: "low" } : {})
      })
    });

    const data = await groqResponse.json();

    if (!groqResponse.ok) {
      console.error("Groq API error:", data);
      // Surface Retry-After so the client can back off intelligently on 429s.
      const retryAfter = groqResponse.headers.get("retry-after");
      return res.status(groqResponse.status).json({
        error: data?.error?.message || "Groq request failed.",
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
