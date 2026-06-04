// @lovable.dev/vite-tanstack-config already includes the following — do NOT add them manually
// or the app will break with duplicate plugins:
//   - tanstackStart, viteReact, tailwindcss, tsConfigPaths, nitro (build-only using cloudflare as a default target),
//     componentTagger (dev-only), VITE_* env injection, @ path alias, React/TanStack dedupe,
//     error logger plugins, and sandbox detection (port/host/strictPort).
// You can pass additional config via defineConfig({ vite: { ... }, etc... }) if needed.
import { defineConfig } from "@lovable.dev/vite-tanstack-config";
import { visualizer } from "rollup-plugin-visualizer";

const analyze = !!process.env.ANALYZE;

export default defineConfig({
  tanstackStart: {
    // Redirect TanStack Start's bundled server entry to src/server.ts (our SSR error wrapper).
    // nitro/vite builds from this
    server: { entry: "server" },
  },
  vite: {
    build: {
      rollupOptions: {
        output: {
          manualChunks(id: string) {
            if (id.includes("node_modules")) {
              if (id.includes("react")) return "vendor.react";
              if (id.includes("framer-motion")) return "vendor.motion";
              if (id.includes("@tanstack")) return "vendor.tanstack";
              if (id.includes("@supabase")) return "vendor.supabase";
              if (id.includes("lucide-react")) return "vendor.icons";
              return "vendor";
            }
          },
        },
      },
      chunkSizeWarningLimit: 600,
    },
    plugins: analyze ? [visualizer({ filename: "dist/stats.html", open: false })] : [],
  },
});
