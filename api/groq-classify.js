// Native Groq endpoint, used ONLY by the two conversation-state classifiers
// (focus/stage and readiness) added in index.html. Everything else — main
// replies, the existing classify() risk/scope call, the evaluator, memory
// extraction, quick replies — still goes through api/chat.js -> OpenRouter.
// This exists purely so those two calls can hit Groq directly instead, for
// latency. Reuses the GROQ_API_KEY already sitting in the Vercel env from
// before the OpenRouter migration (the old callGroq() name in index.html is
// a leftover from that era — it doesn't actually call Groq anymore, this
// file is what does now).
export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: "GROQ_API_KEY is not configured." });
  }
  try {
    const { system, user, model, max_tokens, reasoning_effort } = req.body || {};
    if (!system || !user || !model) {
      return res.status(400).json({ error: "Invalid request." });
    }
    const body = {
      model,
      messages: [
        { role: "system", content: system },
        { role: "user", content: user }
      ],
      // These are short JSON verdicts, not conversation replies — keep the
      // budget tight and temperature low so output stays consistent.
      max_tokens: Math.min(Number(max_tokens) || 150, 400),
      temperature: 0.2,
      response_format: { type: "json_object" }
    };
    // gpt-oss models on Groq expose a native reasoning_effort setting
    // (e.g. "low"/"medium"/"high"). NOT confirmed whether Qwen models on
    // Groq accept the same field name — if it's silently ignored that's
    // fine, but verify before assuming it actually lowers Qwen's latency.
    if (reasoning_effort) body.reasoning_effort = reasoning_effort;
    // No explicit cache_control here (unlike api/chat.js's OpenRouter path).
    // Groq's own prompt caching is understood to be automatic based on an
    // identical, repeated prefix — not independently verified for this app's
    // timeframe. The system prompt below is 100% static across calls by
    // design (all per-turn content lives in the user message) specifically
    // so it qualifies for that, whatever the exact mechanism turns out to be.
    const groqResponse = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${apiKey}`
      },
      body: JSON.stringify(body)
    });
    const data = await groqResponse.json();
    if (!groqResponse.ok) {
      console.error("Groq API error:", data);
      return res.status(groqResponse.status).json({
        error: data?.error?.message || "Groq request failed."
      });
    }
    if (data?.usage) console.log("[Sukoon] groq usage:", model, data.usage);
    const text = data?.choices?.[0]?.message?.content || "";
    return res.status(200).json({ text });
  } catch (error) {
    console.error("Groq server error:", error);
    return res.status(500).json({ error: "Unable to reach Groq." });
  }
}
