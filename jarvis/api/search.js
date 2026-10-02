export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const { query } = req.body || {};
  const rawKey = process.env.TAVILY_API_KEY || process.env.TAVILY_KEY;
  const apiKey = typeof rawKey === "string"
    ? rawKey.trim().replace(/^([\'\"])(.*)\1$/, "$2")
    : "";

  if (!apiKey) return res.status(500).json({
    error: "Missing TAVILY_API_KEY. Add it to your server environment to enable browser search."
  });

  if (!query || typeof query !== "string") {
    return res.status(400).json({ error: "A search query is required." });
  }

  try {
    const response = await fetch("https://api.tavily.com/search", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        api_key: apiKey,
        query: query.slice(0, 500),
        search_depth: "advanced",
        topic: "general",
        max_results: 5,
        include_answer: false,
        include_raw_content: false
      })
    });

    const data = await response.json();
    if (!response.ok) {
      return res.status(response.status).json({
        error: data?.detail || data?.message || "Web search failed."
      });
    }

    const results = (data.results || []).map((item) => ({
      title: item.title,
      url: item.url,
      content: item.content || "",
      score: item.score
    }));

    return res.status(200).json({ results });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: "Web search service failed." });
  }
}