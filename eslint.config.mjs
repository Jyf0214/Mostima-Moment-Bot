import nextConfig from "eslint-config-next/core-web-vitals";
import tseslint from "typescript-eslint";

const eslintConfig = [
  ...nextConfig,
  // 测试文件放宽规则
  {
    name: "test-overrides",
    files: ["src/__tests__/**/*.ts", "src/__tests__/**/*.tsx"],
    rules: {
      "@typescript-eslint/no-explicit-any": "off",
    },
  },
  {
    name: "custom-rules",
    plugins: {
      "@typescript-eslint": tseslint.plugin,
    },
    rules: {
      "@next/next/no-img-element": "warn",
      "@typescript-eslint/no-explicit-any": "warn",
      "@typescript-eslint/no-unused-vars": ["error", { argsIgnorePattern: "^_" }],
      "no-console": ["error", { allow: ["error", "warn"] }],
      "prefer-const": "error",
      "react/no-unescaped-entities": "warn",
      // 数据获取在 useEffect 中是标准模式，此规则过于严格
      "react-hooks/set-state-in-effect": "off",
    },
  },
  {
    ignores: [".next/**", "node_modules/**", "dist/**", "src/lib/**"],
  },
];

export default eslintConfig;
