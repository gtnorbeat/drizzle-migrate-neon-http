// @ts-check
import js from "@eslint/js";
import globals from "globals";

export default [
  { ignores: ["node_modules/", "dist/", "docs/.vitepress/dist/", "coverage/"] },
  js.configs.recommended,
  {
    files: ["bin/**/*.mjs", "src/**/*.mjs", "test/**/*.mjs"],
    languageOptions: {
      ecmaVersion: "latest",
      sourceType: "module",
      globals: {
        ...globals.node,
        ...globals.es2023,
      },
    },
    rules: {
      "no-console": "off",
      "no-unused-vars": ["error", { argsIgnorePattern: "^_", varsIgnorePattern: "^_" }],
    },
  },
];
