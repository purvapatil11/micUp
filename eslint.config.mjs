import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    rules: {
      // Supabase's generated types for embedded/joined resources resolve to
      // arrays even for has-one relationships; `as any` casts are required
      // at every join site. Disable rather than fight the type system.
      "@typescript-eslint/no-explicit-any": "off",
      // Unused vars: allow underscore-prefixed and tolerate Supabase
      // destructuring patterns.
      "@typescript-eslint/no-unused-vars": [
        "warn",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
      ],
    },
  },
  globalIgnores([
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
  ]),
]);

export default eslintConfig;
