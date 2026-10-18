import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    ".next-emotion/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // Local Python inference environments and downloaded third-party assets.
    "services/**/.venv*/**",
    "services/**/.cache/**",
    "services/**/.test-deps/**",
  ]),
]);

export default eslintConfig;
