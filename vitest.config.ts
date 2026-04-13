import { defineConfig } from "vitest/config"
import path from "path"

export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "."),
    },
  },
  test: {
    include: ["__tests__/**/*.test.ts", "__tests__/**/*.test.tsx", "lib/__tests__/**/*.test.ts", "app/**/__tests__/**/*.test.ts", "components/__tests__/**/*.test.ts"],
    environment: "jsdom",
  },
})
