import { defineConfig } from "vite";

export default defineConfig(({ command }) => ({
  base: command === "build" ? "/component-model-loader/" : "/",
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
