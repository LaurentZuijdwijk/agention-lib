import { defineConfig } from "eslint/config";
import globals from "globals";
import js from "@eslint/js";
import tseslint from "typescript-eslint";

export default defineConfig([
  { ignores: ["dist/**", "docs/**", "**/*.spec.ts"] },
  {
    files: ["**/*.ts"],
    languageOptions: { globals: { ...globals.node } },
  },
  {
    files: ["**/*.ts"],
    plugins: { js },
    extends: ["js/recommended"],
  },
  tseslint.configs.recommended,
  {
    files: ["**/*.ts"],
    rules: {
      // `any` is still used deliberately in a few generic boundaries (e.g.
      // Tool.ts) and is tracked as a dedicated cleanup task — keep it visible
      // as a warning rather than a build-blocking error.
      "@typescript-eslint/no-explicit-any": "warn",
      // Allow `@ts-ignore` when it carries an explanation — used to keep
      // optional peer dependencies (e.g. voyageai) out of the hard build graph.
      "@typescript-eslint/ban-ts-comment": [
        "error",
        { "ts-ignore": "allow-with-description" },
      ],
      // Honour the `_`-prefix convention for intentionally-unused identifiers.
      "@typescript-eslint/no-unused-vars": [
        "error",
        {
          argsIgnorePattern: "^_",
          varsIgnorePattern: "^_",
          caughtErrorsIgnorePattern: "^_",
        },
      ],
    },
  },
]);
