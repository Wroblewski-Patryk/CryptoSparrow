import { existsSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { describe, expect, it } from "vitest";

const resolveWebSrc = () => {
  const monorepoPath = resolve(process.cwd(), "apps/web/src");
  if (existsSync(monorepoPath)) return monorepoPath;
  return resolve(process.cwd(), "src");
};

const MONITORED_ROUTE_FILES = [
  "app/dashboard/backtests/create/page.tsx",
  "app/dashboard/backtests/list/page.tsx",
  "app/dashboard/backtests/[id]/page.tsx",
  "app/dashboard/bots/page.tsx",
  "ui/layout/dashboard/LanguageSwitcher.tsx",
  "features/auth/components/LoginForm.tsx",
  "features/auth/components/RegisterForm.tsx",
  "features/auth/components/PasswordVisibilityToggle.tsx",
  "features/auth/hooks/useLoginForm.ts",
  "features/auth/hooks/useRegisterForm.ts",
  "features/auth/pages/LoginPage.tsx",
  "features/auth/pages/RegisterPage.tsx",
  "features/admin/users/pages/AdminUsersPage.tsx",
  "features/admin/subscriptions/pages/AdminSubscriptionsPage.tsx",
  "app/admin/layout.tsx",
  "features/admin/layout/AdminLayoutShell.tsx",
];

const LOCAL_COPY_PATTERN = /const\s+\w*copy\w*\s*=|const\s+\w+\s*=\s*{[\s\S]*?\b(?:en|pl|pt)\s*:/i;
const FALLBACK_PL_PATTERN = /(?:\?\?|\|\|)\s*['"]pl['"]/;
const HARD_CODED_ATTRIBUTE_PATTERN =
  /\b(?:title|placeholder|aria-label|aria-placeholder)\s*=\s*['"][^'"{][^'"]*['"]/g;
const HARD_CODED_TOAST_PATTERN =
  /toast\.(?:success|error|info|warning)\s*\(\s*['"][^'"]+['"]/g;

type GuardrailScanResult = {
  localCopy: boolean;
  fallbackPl: boolean;
  hardcodedUiMatches: string[];
};

const collectMatches = (source: string, pattern: RegExp) => {
  const matches = source.match(pattern);
  return matches ? Array.from(new Set(matches)) : [];
};

const scanSource = (source: string): GuardrailScanResult => ({
  localCopy: LOCAL_COPY_PATTERN.test(source),
  fallbackPl: FALLBACK_PL_PATTERN.test(source),
  hardcodedUiMatches: [
    ...collectMatches(source, HARD_CODED_ATTRIBUTE_PATTERN),
    ...collectMatches(source, HARD_CODED_TOAST_PATTERN),
  ],
});

const scanFiles = (relativePaths: string[]) => {
  const root = resolveWebSrc();
  return relativePaths.map((relativePath) => {
    const absolutePath = join(root, relativePath);
    const source = readFileSync(absolutePath, "utf8");
    return {
      relativePath,
      ...scanSource(source),
    };
  });
};

describe("i18n guardrails", () => {
  it("blocks route-reachable local copy dictionary regressions", () => {
    const offenders = scanFiles(MONITORED_ROUTE_FILES)
      .filter((entry) => entry.localCopy)
      .map((entry) => entry.relativePath);

    expect(offenders, `Local copy dictionary found in:\n${offenders.join("\n")}`).toEqual([]);
  });

  it("blocks route-reachable locale fallback drift to pl", () => {
    const offenders = scanFiles(MONITORED_ROUTE_FILES)
      .filter((entry) => entry.fallbackPl)
      .map((entry) => entry.relativePath);

    expect(offenders, `Locale fallback to 'pl' found in:\n${offenders.join("\n")}`).toEqual([]);
  });

  it("blocks hardcoded UI literals in monitored attribute/toast contexts", () => {
    const offenders = scanFiles(MONITORED_ROUTE_FILES)
      .filter((entry) => entry.hardcodedUiMatches.length > 0)
      .map((entry) => `${entry.relativePath}\n  - ${entry.hardcodedUiMatches.join("\n  - ")}`);

    expect(offenders, `Hardcoded UI string matches found in:\n${offenders.join("\n")}`).toEqual([]);
  });

  it("detects seeded regression fixture for all hard-fail categories", () => {
    const root = resolveWebSrc();
    const fixturePath = join(root, "i18n/__fixtures__/guardrails.seed-regression.tsx");
    const fixtureSource = readFileSync(fixturePath, "utf8");
    const result = scanSource(fixtureSource);

    expect(result.localCopy).toBe(true);
    expect(result.fallbackPl).toBe(true);
    expect(result.hardcodedUiMatches.length).toBeGreaterThan(0);
  });
});
