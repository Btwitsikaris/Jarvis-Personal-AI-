import { defineConfig, loadEnv, type Plugin } from "vite";
import react from "@vitejs/plugin-react";

const MAX_BODY_BYTES = 2 * 1024 * 1024;

// Local-only: serves /api/* from the same handlers Vercel runs in production.
function devApi(): Plugin {
  return {
    name: "dev-api",
    configureServer(server) {
      const env = loadEnv("development", process.cwd(), "");
      // Prefer the project's .env over stale shell variables in local development.
      for (const k of ["GROQ_API_KEY", "TAVILY_API_KEY", "ACCESS_CODE", "ALLOWED_ORIGINS", "RATE_LIMIT_PER_MIN", "GROQ_MODEL"]) {
        if (env[k]) process.env[k] = env[k];
      }

      const mount = (path: string, file: string) => {
        server.middlewares.use(path, async (req, res) => {
          const response = res as any;
          response.status = (code: number) => {
            res.statusCode = code;
            return response;
          };
          response.json = (data: unknown) => {
            res.setHeader("Content-Type", "application/json");
            res.end(JSON.stringify(data));
          };

          try {
            const chunks: Buffer[] = [];
            let size = 0;
            for await (const chunk of req) {
              size += (chunk as Buffer).length;
              if (size > MAX_BODY_BYTES) return response.status(413).json({ error: "Request too large." });
              chunks.push(chunk as Buffer);
            }
            let body: unknown = {};
            try {
              body = JSON.parse(Buffer.concat(chunks).toString() || "{}");
            } catch {
              body = null;
            }
            (req as any).body = body;
            const mod = await server.ssrLoadModule(file);
            await mod.default(req, response);
          } catch (err) {
            console.error(err);
            if (!res.headersSent) response.status(500).json({ error: "Internal server error." });
          }
        });
      };

      mount("/api/chat", "/api/chat.js");
      mount("/api/search", "/api/search.js");
    },
  };
}

export default defineConfig({
  plugins: [react(), devApi()],
  build: { chunkSizeWarningLimit: 1000 },
});
