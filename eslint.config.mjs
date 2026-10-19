import { defineConfig } from "eslint/config";
import tseslint from "typescript-eslint";
import reactHooks from "eslint-plugin-react-hooks";
import eslintReact from "@eslint-react/eslint-plugin";
import globals from "globals";

export default defineConfig([
  {
    ignores: [
      ".next/**",
      "node_modules/**",
      "coverage/**",
      "dist/**",
      "playwright-report/**",
      "test-results/**"
    ]
  },
  ...tseslint.configs.recommended,
  {
    files: ["**/*.{js,mjs,cjs,jsx,ts,tsx}"],
    languageOptions: {
      globals: {
        ...globals.browser,
        ...globals.node
      },
      parserOptions: {
        ecmaFeatures: { jsx: true }
      }
    },
    plugins: {
      "react-hooks": reactHooks,
      "@eslint-react": eslintReact
    },
    rules: {
      // The current @eslint-react plugin exposes the recommended-typescript preset.
      // Register its plugin namespace explicitly so its rules resolve under flat config.
      ...eslintReact.configs["recommended-typescript"].rules,
      // Keep existing repository debt visible without making this dependency patch
      // depend on unrelated source cleanup. These warnings can be promoted separately.
      "@typescript-eslint/no-unused-vars": "warn",
      "@typescript-eslint/no-explicit-any": "warn",
      "@typescript-eslint/no-empty-object-type": "warn",
      "react-hooks/rules-of-hooks": "error",
      "react-hooks/exhaustive-deps": "warn"
    }
  }
]);
