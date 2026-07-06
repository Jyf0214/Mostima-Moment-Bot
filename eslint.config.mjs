import nextConfig from "eslint-config-next/core-web-vitals";
import tseslint from "typescript-eslint";

const eslintConfig = [
  ...nextConfig,
  // [BUILDER-C-B-C-001] 项目自定义规则（全局生效）— 必须在 test-overrides 之前
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
  // [BUILDER-C-B-C-001] 测试文件放宽规则（必须在 custom-rules 之后，flat config 中后者覆盖前者）
  {
    name: "test-overrides",
    files: ["src/__tests__/**/*.ts", "src/__tests__/**/*.tsx"],
    rules: {
      "@typescript-eslint/no-explicit-any": "off",
    },
  },
  {
    ignores: [".next/**", "node_modules/**", "dist/**", "src/lib/**", "coverage/**"],
  },
];

export default eslintConfig;
