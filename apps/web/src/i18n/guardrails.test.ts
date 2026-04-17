import { existsSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { describe, expect, it } from "vitest";

const resolveWebSrc = () => {
  const monorepoPath = resolve(process.cwd(), "apps/web/src");
  if (existsSync(monorepoPath)) return monorepoPath;
  return resolve(process.cwd(), "src");
};

describe("i18n guardrails", () => {
  it("blocks locale clamp regressions (en/pl coercion)", () => {
    const root = resolveWebSrc();
    const hotspotFiles = [
      join(root, "app/dashboard/backtests/create/page.tsx"),
      join(root, "app/dashboard/backtests/list/page.tsx"),
      join(root, "app/dashboard/backtests/[id]/page.tsx"),
      join(root, "app/dashboard/bots/page.tsx"),
      join(root, "ui/layout/dashboard/LanguageSwitcher.tsx"),
    ];

    const clampPattern = /locale\s*===\s*['\"]en['\"]\s*\?\s*['\"][^'\"]+['\"]\s*:\s*['\"][^'\"]+['\"]/;
    const offenders = hotspotFiles.filter((file) => {
      const source = readFileSync(file, "utf8");
      return clampPattern.test(source);
    });

    expect(offenders, `Locale clamp found in:\n${offenders.join("\n")}`).toEqual([]);
  });

  it("keeps selected dashboard hotspots free of local copy objects", () => {
    const root = resolveWebSrc();
    const hotspots = [
      join(root, "app/dashboard/backtests/create/page.tsx"),
      join(root, "app/dashboard/backtests/list/page.tsx"),
      join(root, "app/dashboard/backtests/[id]/page.tsx"),
      join(root, "app/dashboard/bots/page.tsx"),
      join(root, "ui/layout/dashboard/LanguageSwitcher.tsx"),
    ];

    const offenders = hotspots.filter((file) => {
      const source = readFileSync(file, "utf8");
      return /const\s+copy\s*=/.test(source);
    });

    expect(offenders, `Hardcoded copy in hotspots:\n${offenders.join("\n")}`).toEqual([]);
  });
});
