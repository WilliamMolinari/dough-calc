import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    // Pure logic runs in node; the few DOM/IndexedDB tests opt in with a
    // `@vitest-environment jsdom` docblock at the top of the file.
    environment: "node",
    include: ["src/**/*.test.ts", "src/**/*.test.tsx"],
  },
});
