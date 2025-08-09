import { defineConfig } from "vite";

export default defineConfig(({ command }) => ({
  base: command === "build" ? "/<REPO_NAME>/" : "/",
  server: {
    headers: {
      "Cross-Origin-Embedder-Policy": "require-corp",
      "Cross-Origin-Opener-Policy": "same-origin",
    },
  },
  optimizeDeps: {
    exclude: ["@bytecodealliance/jco"],
  },
  assetsInclude: ["**/*.wasm"],
}));
