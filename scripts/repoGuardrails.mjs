import fs from "node:fs";
import path from "node:path";
import { execSync } from "node:child_process";

const ROOT_DIR = process.cwd();
const EXPECTED_LOCKFILE = "pnpm-lock.yaml";
const FORBIDDEN_LOCKFILES = new Set([
  "package-lock.json",
  "yarn.lock",
  "bun.lockb",
  "npm-shrinkwrap.json",
]);

const SOURCE_FILE_RE = /^apps\/(?:web|api)\/src\/.+\.(?:ts|tsx|js|jsx)$/;
const DEFAULT_MAX_FILE_BYTES = 90_000;
const FILE_SIZE_BUDGET_OVERRIDES = new Map([
  ["apps/api/src/modules/bots/bots.service.ts", 125_000],
  ["apps/web/src/features/backtest/components/BacktestRunDetails.tsx", 110_000],
]);

const IGNORED_DIRS = new Set([
  ".git",
  "node_modules",
  ".next",
  "dist",
  "build",
  "coverage",
  ".turbo",
]);

const normalize = (value) => value.replace(/\\/g, "/");

const readTrackedFiles = () => {
  const output = execSync("git ls-files", { encoding: "utf8" });
  return output
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map(normalize);
};

const collectForbiddenLockfilesOnDisk = (dirPath, acc = []) => {
  const entries = fs.readdirSync(dirPath, { withFileTypes: true });
  for (const entry of entries) {
    if (entry.isDirectory()) {
      if (IGNORED_DIRS.has(entry.name)) continue;
      collectForbiddenLockfilesOnDisk(path.join(dirPath, entry.name), acc);
      continue;
    }
    if (!entry.isFile()) continue;
    if (!FORBIDDEN_LOCKFILES.has(entry.name)) continue;
    const absolute = path.join(dirPath, entry.name);
    const relative = normalize(path.relative(ROOT_DIR, absolute));
    acc.push(relative);
  }
  return acc;
};

const validateLockfilePolicy = (trackedFiles) => {
  const errors = [];
  if (!trackedFiles.includes(EXPECTED_LOCKFILE)) {
    errors.push(`Missing required lockfile: ${EXPECTED_LOCKFILE}`);
  }

  const forbiddenTracked = trackedFiles.filter((filePath) => {
    const base = path.basename(filePath);
    return FORBIDDEN_LOCKFILES.has(base);
  });
  if (forbiddenTracked.length > 0) {
    errors.push(
      `Forbidden lockfiles tracked in git:\n${forbiddenTracked
        .map((filePath) => `  - ${filePath}`)
        .join("\n")}`
    );
  }

  const forbiddenOnDisk = collectForbiddenLockfilesOnDisk(ROOT_DIR);
  if (forbiddenOnDisk.length > 0) {
    errors.push(
      `Forbidden lockfiles present on disk:\n${forbiddenOnDisk
        .map((filePath) => `  - ${filePath}`)
        .join("\n")}`
    );
  }

  return errors;
};

const validateSourceFileBudgets = (trackedFiles) => {
  const oversize = [];
  for (const filePath of trackedFiles) {
    if (!SOURCE_FILE_RE.test(filePath)) continue;
    const absolute = path.join(ROOT_DIR, filePath);
    let stats;
    try {
      stats = fs.statSync(absolute);
    } catch {
      continue;
    }
    const budget = FILE_SIZE_BUDGET_OVERRIDES.get(filePath) ?? DEFAULT_MAX_FILE_BYTES;
    if (stats.size > budget) {
      oversize.push({
        filePath,
        size: stats.size,
        budget,
      });
    }
  }

  if (oversize.length === 0) return [];
  return [
    `Source file size budget exceeded:\n${oversize
      .map(
        ({ filePath, size, budget }) =>
          `  - ${filePath}: ${size} bytes (budget ${budget} bytes)`
      )
      .join("\n")}`,
  ];
};

const run = () => {
  const trackedFiles = readTrackedFiles();
  const errors = [
    ...validateLockfilePolicy(trackedFiles),
    ...validateSourceFileBudgets(trackedFiles),
  ];

  if (errors.length > 0) {
    console.error("Repository guardrails check failed:");
    for (const error of errors) {
      console.error(`\n${error}`);
    }
    process.exit(1);
  }

  console.log("Repository guardrails check passed.");
  console.log(`- Lockfile policy: OK (${EXPECTED_LOCKFILE} only)`);
  console.log(`- Source file budget: OK (default ${DEFAULT_MAX_FILE_BYTES} bytes)`);
};

run();

