import { cleanKey, guard, safeUrl, str } from "./_lib/guard.js";

export default async function handler(req, res) {
  const body = guard(req, res, "search");
  if (!body) return;

  try {
    const apiKey = cleanKey(process.env.TAVILY_API_KEY || process.env.TAVILY_KEY);
    if (!apiKey) return res.status(500).json({ error: "Web search is not configured (missing TAVILY_API_KEY)." });

    const query = str(body.query, 500).trim();
    if (!query) return res.status(400).json({ error: "A search query is required." });

    const response = await fetch("https://api.tavily.com/search", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        query,
        search_depth: "basic",
        topic: "general",
        max_results: 5,
        include_answer: false,
        include_raw_content: false,
      }),
      signal: AbortSignal.timeout(20_000),
    });

    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      console.error(`Tavily ${response.status}`);
      return res.status(response.status === 429 ? 429 : 502).json({
        error: response.status === 429 ? "Web search is rate-limited. Try again shortly." : "Web search failed.",
      });
    }

    const results = (Array.isArray(data.results) ? data.results : [])
      .map((item) => {
        const url = safeUrl(item?.url);
        return url ? { title: str(item.title, 200) || url, url, content: str(item.content, 1500), score: typeof item.score === "number" ? item.score : undefined } : null;
      })
      .filter(Boolean)
      .slice(0, 5);

    return res.status(200).json({ results });
  } catch (error) {
    console.error(error);
    const timeout = error?.name === "TimeoutError" || error?.name === "AbortError";
    return res.status(timeout ? 504 : 500).json({ error: timeout ? "Web search timed out." : "Web search service failed." });
  }
}
