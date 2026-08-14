export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: "GROQ_API_KEY is not configured." });
  }

  try {
    const { system, messages, model, max_tokens, plain_text } = req.body || {};

    if (!system || !Array.isArray(messages)) {
      return res.status(400).json({ error: "Invalid request." });
    }

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
        // json_object mode has been the source of every observed "Failed to generate/
        // validate JSON" 400 — and only ever on the main/retry reply call, never on
        // classify/evaluator/coder/memory. Rather than keep tuning that mode, main/
        // retry now skip it entirely (plain_text:true) and use a simple delimited
        // text format parsed client-side, which Groq can't reject as invalid JSON
        // because no JSON is being requested. Other stages keep json_object — their
        // simpler shapes haven't shown this failure.
        ...(plain_text ? {} : { response_format: { type: "json_object" } }),
        // gpt-oss models are reasoning models — by default they spend hidden
        // chain-of-thought tokens (medium effort) before the visible answer,
        // and those tokens count against max_tokens. Low effort keeps more of
        // the budget for the actual answer.
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
