import { defineConfig } from "eslint/config";
import globals from "globals";
import js from "@eslint/js";
import tseslint from "typescript-eslint";

export default defineConfig([
  { files: ["**/*.{ts}"] },
  {
    files: ["**/*.{ts}"],
    languageOptions: { globals: { ...globals.node } },
  },
  {
    files: ["**/*.{ts}"],
    plugins: { js },
    extends: ["js/recommended"],
  },
  tseslint.configs.recommended,
]);
