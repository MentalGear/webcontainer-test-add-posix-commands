import { serve } from "bun";
import { join } from "path";
import { readFile } from "fs/promises";

const PORT = 3000;
const BASE_DIR = import.meta.dir;

console.log(`Starting playground server on http://localhost:${PORT}...`);

serve({
  port: PORT,
  async fetch(req) {
    const url = new URL(req.url);
    let path = url.pathname;

    if (path === "/") path = "/index.html";

    const filePath = join(BASE_DIR, path);

    try {
      const content = await readFile(filePath);
      const extension = filePath.split(".").pop();
      const contentType =
        {
          html: "text/html",
          js: "text/javascript",
          css: "text/css",
        }[extension!] || "text/plain";

      return new Response(content, {
        headers: {
          "Content-Type": contentType,
          "Cross-Origin-Embedder-Policy": "require-corp",
          "Cross-Origin-Opener-Policy": "same-origin",
        },
      });
    } catch (e) {
      console.error(`404: ${filePath}`);
      return new Response("Not Found", { status: 404 });
    }
  },
});
