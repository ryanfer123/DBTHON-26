import a11y from "eslint-plugin-jsx-a11y";
import js from "@eslint/js";
import globals from "globals";
import hooks from "eslint-plugin-react-hooks";
import refresh from "eslint-plugin-react-refresh";
import tseslint from "typescript-eslint";

export default tseslint.config(
  { ignores: ["dist", "node_modules", "playwright-report", "test-results"] },
  {
    files: ["**/*.{ts,tsx}"],
    extends: [js.configs.recommended, ...tseslint.configs.recommended],
    languageOptions: { ecmaVersion: 2022, globals: globals.browser },
    plugins: {
      "react-hooks": hooks,
      "react-refresh": refresh,
      "jsx-a11y": a11y,
    },
    rules: {
      ...hooks.configs.recommended.rules,
      ...a11y.configs.recommended.rules,
      // Named overflow regions must be focusable for keyboard scrolling.
      "jsx-a11y/no-noninteractive-tabindex": [
        "error",
        { roles: ["region", "tabpanel"] },
      ],
      "react-refresh/only-export-components": [
        "warn",
        { allowConstantExport: true },
      ],
    },
  },
);
