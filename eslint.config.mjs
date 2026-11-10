import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    rules: {
      // Boundary casts between Prisma rows and component props are intentional
      // in this codebase — keep them visible as warnings, not build-blockers.
      "@typescript-eslint/no-explicit-any": "warn",
      // `_name` marks a value that's deliberately unused; `{ a, ...rest }` drops a field on purpose.
      "@typescript-eslint/no-unused-vars": [
        "warn",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_", ignoreRestSiblings: true },
      ],
    },
  },
  {
    // Standalone CommonJS scripts run directly by node, not bundled by Next —
    // require() is correct there.
    files: ["prisma/**/*.js", "scripts/**/*.js"],
    rules: { "@typescript-eslint/no-require-imports": "off" },
  },
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
  ]),
]);

export default eslintConfig;
