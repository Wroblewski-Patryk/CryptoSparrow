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
const WEB_FEATURE_SOURCE_FILE_RE = /^apps\/web\/src\/features\/([^/]+)\/.+\.(?:ts|tsx|js|jsx)$/;
const WEB_FEATURE_FIELD_CONTROLS_RE =
  /^apps\/web\/src\/features\/([^/]+)\/components\/FieldControls\.(?:ts|tsx|js|jsx)$/;
const DEFAULT_MAX_FILE_BYTES = 90_000;
const SOURCE_FILE_BUDGET_RULES = [
  { match: /^apps\/api\/src\//, budget: 90_000 },
  { match: /^apps\/web\/src\//, budget: 105_000 },
];

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

const resolveSourceFileBudget = (filePath) => {
  for (const rule of SOURCE_FILE_BUDGET_RULES) {
    if (rule.match.test(filePath)) return rule.budget;
  }
  return DEFAULT_MAX_FILE_BYTES;
};

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
    const budget = resolveSourceFileBudget(filePath);
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

const resolveCandidateFile = (baseAbsolutePath) => {
  const candidates = [
    baseAbsolutePath,
    `${baseAbsolutePath}.ts`,
    `${baseAbsolutePath}.tsx`,
    `${baseAbsolutePath}.js`,
    `${baseAbsolutePath}.jsx`,
    path.join(baseAbsolutePath, "index.ts"),
    path.join(baseAbsolutePath, "index.tsx"),
    path.join(baseAbsolutePath, "index.js"),
    path.join(baseAbsolutePath, "index.jsx"),
  ];

  for (const candidate of candidates) {
    if (!fs.existsSync(candidate)) continue;
    const stats = fs.statSync(candidate);
    if (!stats.isFile()) continue;
    return normalize(path.relative(ROOT_DIR, candidate));
  }

  return null;
};

const extractImportSpecifiers = (sourceText) => {
  const specifiers = [];

  const staticImportRegex = /(?:import|export)\s+[^'"`]*?\sfrom\s+['"`]([^'"`]+)['"`]/g;
  for (const match of sourceText.matchAll(staticImportRegex)) {
    specifiers.push(match[1]);
  }

  const dynamicImportRegex = /import\(\s*['"`]([^'"`]+)['"`]\s*\)/g;
  for (const match of sourceText.matchAll(dynamicImportRegex)) {
    specifiers.push(match[1]);
  }

  return specifiers;
};

const resolveWebImportSpecifier = (fromFilePath, specifier) => {
  let absoluteBasePath = null;

  if (specifier.startsWith("./") || specifier.startsWith("../")) {
    absoluteBasePath = path.resolve(path.dirname(path.join(ROOT_DIR, fromFilePath)), specifier);
  } else if (specifier.startsWith("@/")) {
    absoluteBasePath = path.resolve(ROOT_DIR, "apps", "web", "src", specifier.slice(2));
  } else {
    return null;
  }

  return resolveCandidateFile(absoluteBasePath);
};

const validateWebFormImportBoundaries = (trackedFiles) => {
  const violations = [];
  const webFeatureFiles = trackedFiles.filter((filePath) => WEB_FEATURE_SOURCE_FILE_RE.test(filePath));

  for (const sourceFilePath of webFeatureFiles) {
    const sourceMatch = WEB_FEATURE_SOURCE_FILE_RE.exec(sourceFilePath);
    if (!sourceMatch) continue;
    const sourceFeature = sourceMatch[1];

    const absolutePath = path.join(ROOT_DIR, sourceFilePath);
    const sourceText = fs.readFileSync(absolutePath, "utf8");
    const specifiers = extractImportSpecifiers(sourceText);

    for (const specifier of specifiers) {
      if (!specifier.includes("FieldControls")) continue;
      const resolvedImport = resolveWebImportSpecifier(sourceFilePath, specifier);
      if (!resolvedImport) continue;

      const targetMatch = WEB_FEATURE_FIELD_CONTROLS_RE.exec(resolvedImport);
      if (!targetMatch) continue;

      const targetFeature = targetMatch[1];
      if (targetFeature === sourceFeature) continue;

      violations.push({
        sourceFilePath,
        sourceFeature,
        targetFeature,
        specifier,
        resolvedImport,
      });
    }
  }

  if (violations.length === 0) return [];

  return [
    `Web form import boundary violated (cross-feature generic FieldControls import detected):\n${violations
      .map(
        ({ sourceFilePath, sourceFeature, targetFeature, specifier, resolvedImport }) =>
          `  - ${sourceFilePath} (${sourceFeature}) imports ${specifier} -> ${resolvedImport} (${targetFeature})`
      )
      .join("\n")}\nUse shared controls from apps/web/src/ui/forms/* instead.`,
  ];
};

const run = () => {
  const trackedFiles = readTrackedFiles();
  const errors = [
    ...validateLockfilePolicy(trackedFiles),
    ...validateSourceFileBudgets(trackedFiles),
    ...validateWebFormImportBoundaries(trackedFiles),
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
  console.log(
    `- Source file budget: OK (api ${SOURCE_FILE_BUDGET_RULES[0].budget} bytes, web ${SOURCE_FILE_BUDGET_RULES[1].budget} bytes)`
  );
};

run();
