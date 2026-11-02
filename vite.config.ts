import vinext from "vinext";
import { resolve } from "node:path";
import { defineConfig } from "vite";
import { sites } from "./build/sites-vite-plugin.ts";

export default defineConfig(async () => {
  process.env.WRANGLER_WRITE_LOGS ??= "false";

  const { cloudflare } = await import("@cloudflare/vite-plugin");

  return {
    // Never copy the local user's listing folders or workspace media into a Site.
    publicDir: false as const,
    resolve: {
      alias: {
        canvas: resolve(process.cwd(), "src/lib/canvas-shim.ts"),
        sharp: resolve(process.cwd(), "src/lib/sharp-shim.ts"),
      },
    },
    plugins: [
      vinext(),
      sites(),
      cloudflare({
        viteEnvironment: { name: "rsc", childEnvironments: ["ssr"] },
        inspectorPort: false,
        config: {
          main: "./worker/index.ts",
          compatibility_flags: ["nodejs_compat"],
          d1_databases: [{ binding: 'DB', database_name: 'site-creator-d1', database_id: '00000000-0000-4000-8000-000000000000' }],
          r2_buckets: [{ binding: 'BUCKET', bucket_name: 'site-creator-r2' }],
          images: { binding: 'IMAGES' },
        },
      }),
    ],
  };
});
