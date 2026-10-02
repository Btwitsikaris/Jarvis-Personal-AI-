import { defineConfig, loadEnv, type Plugin } from "vite";
import react from "@vitejs/plugin-react";

function devApi(): Plugin {
  return {
    name: "dev-api",
    configureServer(server) {
      const env = loadEnv("development", process.cwd(), "");
      // Always prefer the project's .env values in local development.
      // Using ||= can preserve a stale/invalid shell environment variable.
      if (env.GROQ_API_KEY) process.env.GROQ_API_KEY = env.GROQ_API_KEY;
      if (env.TAVILY_API_KEY) process.env.TAVILY_API_KEY = env.TAVILY_API_KEY;

      const mount = (path: string, file: string) => {
        server.middlewares.use(path, async (req, res) => {
          const chunks: Buffer[] = [];
          for await (const chunk of req) chunks.push(chunk as Buffer);

          let body = {};
          try {
            body = JSON.parse(Buffer.concat(chunks).toString() || "{}");
          } catch {}

          const response = res as any;
          response.status = (code: number) => {
            res.statusCode = code;
            return response;
          };
          response.json = (data: unknown) => {
            res.setHeader("Content-Type", "application/json");
            res.end(JSON.stringify(data));
          };

          (req as any).body = body;
          const mod = await server.ssrLoadModule(file);
          await mod.default(req, response);
        });
      };

      mount("/api/chat", "/api/chat.js");
      mount("/api/search", "/api/search.js");
    },
  };
}

export default defineConfig({
  plugins: [react(), devApi()],
});