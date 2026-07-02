import nextCoreWebVitals from "eslint-config-next/core-web-vitals";
import nextTypescript from "eslint-config-next/typescript";

/** @type {import("eslint").Linter.Config[]} */
const eslintConfig = [
    // Global ignores — build output and generated artifacts. Without these,
    // ESLint tries to walk .open-next / .next (tens of thousands of bundled
    // files) and runs out of memory. Keep this first so it applies globally.
    {
        ignores: [
            ".next/**",
            ".open-next/**",
            ".wrangler/**",
            ".wrangler-dry-run/**",
            "node_modules/**",
            "public/**",
            "out/**",
            "dist/**",
            "build/**",
            "coverage/**",
            "next-env.d.ts",
        ],
    },
    ...nextCoreWebVitals,
    ...nextTypescript,
    {
        rules: {
            "@typescript-eslint/no-unused-vars": ["warn", { argsIgnorePattern: "^_", varsIgnorePattern: "^_" }],
            "@typescript-eslint/no-explicit-any": "warn",
            "prefer-const": "warn",
        },
    },
];

export default eslintConfig;
