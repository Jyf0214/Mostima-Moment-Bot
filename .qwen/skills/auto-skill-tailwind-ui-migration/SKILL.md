---
name: tailwind-ui-migration
description: Migrate UI framework from Mantine to Tailwind CSS + custom component library, including reference repo cloning, component copying, page rewriting, and dependency cleanup
source: auto-skill
extracted_at: '2026-06-20T05:57:09.023Z'
---

# UI Framework Migration: Mantine → Tailwind CSS

## Overview

Migrating from a component library (Mantine) to Tailwind CSS + custom components copied from a reference repository. This covers the full workflow: analysis, dependency swap, component copying, page rewriting, and verification.

## Prerequisites

- Reference repository with reusable UI components (e.g., ZhouZBoss-Web)
- Understanding of all pages using the old UI library
- i18n test that scans for hardcoded Chinese (must not break)

## Step-by-Step Procedure

### 1. Analyze Both Codebases (Parallel)

**Current project:**

- List all pages (`src/pages/**/*.tsx`)
- List all Mantine component imports per file
- List all icon imports (`@tabler/icons-react`)
- Check `_app.tsx` for provider setup
- Check `theme.ts` for theme configuration
- Check `tsconfig.json` for path aliases (`@/*`)

**Reference project:**

- Read `package.json` for UI dependencies
- List `components/ui/` directory structure
- Read `lib/ui.ts` for `cn()` utility
- Read `postcss.config.mjs` for Tailwind setup
- Read `app/globals.css` for base styles
- Read 3-5 representative component files

### 2. Install New Dependencies

```bash
npm install tailwindcss @tailwindcss/postcss autoprefixer clsx tailwind-merge lucide-react antd @ant-design/icons
```

### 3. Copy Components and Config Files

```bash
# Core files
cp <ref>/lib/ui.ts src/lib/ui.ts
cp <ref>/postcss.config.mjs postcss.config.mjs

# UI components directory
cp -r <ref>/components/ui/ src/components/ui/

# Create globals.css (Tailwind v4 CSS-first config)
cat > src/app/globals.css << 'EOF'
@import "tailwindcss";
@custom-variant dark (&:where(.dark, .dark *));
EOF
```

### 4. Fix Component Import Issues

**Common issue: `Github` icon not in lucide-react**

lucide-react does NOT export `Github`. Create a custom SVG component:

```tsx
function GithubIcon({ size = 24, className }: { size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" className={className}>
      <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387..." />
    </svg>
  );
}
```

**Common issue: Components with Chinese comments**

The i18n test strips comments before checking for Chinese. JSX comments (`{/* */}`) and inline comments (`//`) are handled by `removeJSXComments()` and `removeSingleLineComments()`. No action needed unless Chinese appears in string literals.

### 5. Update Configuration Files

**next.config.js:**

```js
const nextConfig = {
  transpilePackages: ['antd', '@ant-design/icons'],
  experimental: {
    optimizePackageImports: ['lucide-react'],
  },
};
```

**\_app.tsx:**

- Remove `MantineProvider` wrapper
- Remove `import '@mantine/core/styles.css'`
- Add `import '@/app/globals.css'`
- Replace Mantine `Loader` with Tailwind spinner or `LoadingSpinner` component

### 6. Rewrite Pages (Can Be Parallelized)

For each page:

1. Remove all `@mantine/core` and `@tabler/icons-react` imports
2. Replace with Tailwind utility classes + `lucide-react` icons
3. Keep all i18n keys unchanged (`useTranslation()`)
4. Keep all business logic unchanged
5. Use `cn()` utility for conditional class merging

**Component mapping (Mantine → Tailwind):**

| Mantine                       | Tailwind Equivalent                                                                                     |
| ----------------------------- | ------------------------------------------------------------------------------------------------------- |
| `<Container size="sm">`       | `<div className="mx-auto max-w-sm">`                                                                    |
| `<Paper shadow="xl" p="xl">`  | `<div className="rounded-2xl bg-white p-8 shadow-2xl">`                                                 |
| `<Stack gap="md">`            | `<div className="flex flex-col gap-4">`                                                                 |
| `<Group gap="sm">`            | `<div className="flex items-center gap-2">`                                                             |
| `<Center h="100vh">`          | `<div className="flex h-screen items-center justify-center">`                                           |
| `<Badge color="red">`         | `<span className="rounded-full bg-red-100 px-2.5 py-0.5 text-xs font-medium text-red-700">`             |
| `<ThemeIcon size={72}>`       | `<div className="flex h-[72px] w-[72px] items-center justify-center rounded-full">`                     |
| `<Button variant="light">`    | `<button className="rounded-xl border px-4 py-1.5 text-sm">`                                            |
| `<Loader size="xl" />`        | `<div className="h-12 w-12 animate-spin rounded-full border-4 border-zinc-400 border-t-transparent" />` |
| `<Title order={2}>`           | `<h2 className="text-2xl font-bold">`                                                                   |
| `<Text size="sm" c="dimmed">` | `<p className="text-sm text-gray-500">`                                                                 |
| `<Code block>`                | `<code className="rounded-md bg-gray-900 px-2.5 py-1.5 text-xs text-gray-100">`                         |
| `<Anchor>`                    | `<button className="text-sm text-gray-500 hover:text-gray-800">`                                        |

### 7. Remove Old Dependencies

```bash
npm uninstall @mantine/core @mantine/hooks @tabler/icons-react
```

### 8. Delete Obsolete Files

```bash
rm src/theme.ts  # Mantine theme config
```

### 9. Verify

```bash
# Check no old imports remain
grep -rn "@mantine\|@tabler" src/ --include='*.ts' --include='*.tsx'

# Build
npm run build

# Test (with --forceExit if jest hangs)
npx jest --forceExit
```

## Gotchas

1. **lucide-react missing icons**: `Github` is not exported. Use custom SVG or `@ant-design/icons` `GithubOutlined`.
2. **i18n test**: Copied components with Chinese comments pass because the test strips comments first. But Chinese in string literals will fail.
3. **Tailwind v4**: No `tailwind.config.js` needed. Configuration is CSS-first in `globals.css`.
4. **antd transpilePackages**: Must add `['antd', '@ant-design/icons']` to `next.config.js` for tree-shaking.
5. **Pre-commit hooks**: Build + tests run on commit. Ensure everything passes before committing.
6. **Background agents**: Page rewrites can be parallelized safely since they write to different files.

## Files Changed (Typical Migration)

```
Modified:
  next.config.js          # transpilePackages
  package.json            # dependencies
  src/pages/_app.tsx      # remove MantineProvider
  src/pages/index.tsx     # rewrite with Tailwind
  src/pages/setup.tsx     # rewrite with Tailwind
  src/pages/env-error.tsx # rewrite with Tailwind

Deleted:
  src/theme.ts            # Mantine theme

Created:
  postcss.config.mjs      # Tailwind PostCSS
  src/app/globals.css     # Tailwind base styles
  src/lib/ui.ts           # cn() utility
  src/components/ui/      # 16+ custom UI components
  src/components/ui/index.ts  # barrel exports
```
