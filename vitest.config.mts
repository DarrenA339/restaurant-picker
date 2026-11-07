import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

// Pure-function tests only (lib/**), so the node environment is enough.
// Add jsdom + @vitejs/plugin-react only if component tests are added.
export default defineConfig({
  resolve: {
    alias: { "@": fileURLToPath(new URL(".", import.meta.url)) },
  },
  test: {
    environment: "node",
    include: ["lib/**/*.test.ts"],
  },
});
