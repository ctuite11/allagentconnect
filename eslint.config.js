import js from "@eslint/js";
import globals from "globals";
import reactHooks from "eslint-plugin-react-hooks";
import reactRefresh from "eslint-plugin-react-refresh";
import tseslint from "typescript-eslint";

export default tseslint.config(
  { ignores: ["dist"] },
  {
    extends: [js.configs.recommended, ...tseslint.configs.recommended],
    files: ["**/*.{ts,tsx}"],
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
    },
    plugins: {
      "react-hooks": reactHooks,
      "react-refresh": reactRefresh,
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      "react-refresh/only-export-components": ["warn", { allowConstantExport: true }],
      "@typescript-eslint/no-unused-vars": "off",
    },
  },
  // Phase 6: Status enforcement (warn → error when warnings reach 0)
  // Prevents UI drift: domain statuses must use constants + badges.
  // See: src/constants/status.ts, src/components/ui/status-badge.tsx
  {
    files: ["src/components/**/*.{ts,tsx}", "src/pages/**/*.{ts,tsx}"],
    rules: {
      "no-restricted-syntax": [
        "warn",
        {
          selector: "CallExpression[callee.property.name='replace'][arguments.0.regex.pattern='_']",
          message: "Do not format snake_case manually in UI. Use humanizeSnakeCase() from @/lib or a centralized label map.",
        },
        {
          selector: "BinaryExpression[operator='==='][right.value='coming_soon']",
          message: "Use LISTING_STATUS.COMING_SOON constant instead of raw string comparison.",
        },
        {
          selector: "BinaryExpression[operator='==='][right.value='verified']",
          message: "Use AGENT_STATUS.VERIFIED constant instead of raw string comparison.",
        },
        {
          selector: "BinaryExpression[operator='==='][right.value='pending']",
          message: "Use AGENT_STATUS.PENDING or LISTING_STATUS constants instead of raw string comparison.",
        },
        {
          selector: "BinaryExpression[operator='!=='][right.value='verified']",
          message: "Use AGENT_STATUS.VERIFIED constant instead of raw string comparison.",
        },
        {
          selector: "BinaryExpression[operator='==='][right.value='active']",
          message: "Use LISTING_STATUS.ACTIVE or AGENT_STATUS constants instead of raw string comparison.",
        },
        {
          selector: "BinaryExpression[operator='!=='][right.value='active']",
          message: "Use LISTING_STATUS.ACTIVE or AGENT_STATUS constants instead of raw string comparison.",
        },
      ],
    },
  },
);
