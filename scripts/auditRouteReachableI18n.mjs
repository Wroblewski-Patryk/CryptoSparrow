import fs from "node:fs";
import path from "node:path";
import ts from "typescript";

const ROOT_DIR = process.cwd();
const WEB_SRC_DIR = path.join(ROOT_DIR, "apps/web/src");
const APP_DIR = path.join(WEB_SRC_DIR, "app");
const OUT_DEFAULT = path.join(
  ROOT_DIR,
  "docs/operations/_artifacts-l10nq-d-coverage-audit-latest.json"
);

const SOURCE_EXTENSIONS = [".ts", ".tsx", ".js", ".jsx"];
const ROUTE_FILE_PATTERN = /[\\/]page\.(?:ts|tsx|js|jsx)$/i;
const TEST_FILE_PATTERN = /\.(?:test|spec)\.(?:ts|tsx|js|jsx)$/i;
const SHARED_FOUNDATION_PATTERNS = [
  /[\\/]src[\\/]ui[\\/]/,
  /[\\/]src[\\/]app[\\/]layout\.(?:ts|tsx|js|jsx)$/i,
  /[\\/]src[\\/]app[\\/]\(public\)[\\/]layout\.(?:ts|tsx|js|jsx)$/i,
  /[\\/]src[\\/]app[\\/]admin[\\/]layout\.(?:ts|tsx|js|jsx)$/i,
  /[\\/]src[\\/]ui[\\/]components[\\/]/,
];

const LOCAL_COPY_PATTERNS = [
  /const\s+\w*copy\w*\s*=/i,
  /const\s+\w+\s*=\s*{[\s\S]*?\b(?:en|pl|pt)\s*:/i,
];
const FALLBACK_PL_PATTERN = /(?:\?\?|\|\|)\s*['"]pl['"]|locale\s*===\s*['"]pl['"]/;
const HARD_CODED_ATTRIBUTE_PATTERN =
  /\b(?:title|placeholder|aria-label|aria-placeholder)\s*=\s*['"`][^'"`{][^'"`]*['"`]/g;
const HARD_CODED_TOAST_PATTERN =
  /toast\.(?:success|error|info|warning)\s*\(\s*['"`][^'"`]+['"`]/g;

const normalize = (value) => value.replace(/\\/g, "/");
const toRelative = (absolutePath) => normalize(path.relative(ROOT_DIR, absolutePath));

const parseArgs = () => {
  const args = process.argv.slice(2);
  let outFile = OUT_DEFAULT;

  for (let index = 0; index < args.length; index += 1) {
    const current = args[index];
    if (current === "--out") {
      const next = args[index + 1];
      if (!next) {
        throw new Error("Missing value for --out.");
      }
      outFile = path.resolve(ROOT_DIR, next);
      index += 1;
      continue;
    }
    if (current === "--help") {
      console.log("Usage: node scripts/auditRouteReachableI18n.mjs [--out <file>]");
      process.exit(0);
    }
    throw new Error(`Unknown argument: ${current}`);
  }

  return { outFile };
};

const listSourceFiles = (dirPath) => {
  const stack = [dirPath];
  const files = [];

  while (stack.length > 0) {
    const current = stack.pop();
    const entries = fs.readdirSync(current, { withFileTypes: true });
    for (const entry of entries) {
      const absolutePath = path.join(current, entry.name);
      if (entry.isDirectory()) {
        stack.push(absolutePath);
        continue;
      }
      if (!entry.isFile()) continue;
      if (TEST_FILE_PATTERN.test(entry.name)) continue;
      if (!SOURCE_EXTENSIONS.includes(path.extname(entry.name))) continue;
      files.push(absolutePath);
    }
  }

  return files.sort((left, right) => left.localeCompare(right));
};

const resolveScriptKind = (filePath) => {
  const extension = path.extname(filePath);
  if (extension === ".tsx") return ts.ScriptKind.TSX;
  if (extension === ".jsx") return ts.ScriptKind.JSX;
  if (extension === ".js") return ts.ScriptKind.JS;
  return ts.ScriptKind.TS;
};

const readImports = (filePath, sourceText) => {
  const sourceFile = ts.createSourceFile(
    filePath,
    sourceText,
    ts.ScriptTarget.Latest,
    true,
    resolveScriptKind(filePath)
  );

  if (sourceFile.parseDiagnostics.length > 0) {
    const diagnostics = sourceFile.parseDiagnostics.map((diagnostic) => {
      const message = ts.flattenDiagnosticMessageText(diagnostic.messageText, "\n");
      const lineInfo = diagnostic.start
        ? sourceFile.getLineAndCharacterOfPosition(diagnostic.start)
        : null;
      if (!lineInfo) return message;
      return `L${lineInfo.line + 1}:C${lineInfo.character + 1} ${message}`;
    });

    return {
      imports: [],
      parseErrors: diagnostics,
    };
  }

  const imports = [];
  const visit = (node) => {
    if (ts.isImportDeclaration(node) && ts.isStringLiteral(node.moduleSpecifier)) {
      imports.push(node.moduleSpecifier.text);
    } else if (ts.isExportDeclaration(node) && node.moduleSpecifier && ts.isStringLiteral(node.moduleSpecifier)) {
      imports.push(node.moduleSpecifier.text);
    } else if (
      ts.isCallExpression(node) &&
      node.expression.kind === ts.SyntaxKind.ImportKeyword &&
      node.arguments.length === 1 &&
      ts.isStringLiteral(node.arguments[0])
    ) {
      imports.push(node.arguments[0].text);
    }
    ts.forEachChild(node, visit);
  };

  ts.forEachChild(sourceFile, visit);
  return {
    imports,
    parseErrors: [],
  };
};

const resolveAliasImport = (specifier) => {
  if (!specifier.startsWith("@/")) return null;
  return path.join(WEB_SRC_DIR, specifier.slice(2));
};

const resolveCandidateFile = (basePath) => {
  if (SOURCE_EXTENSIONS.includes(path.extname(basePath)) && fs.existsSync(basePath)) {
    return basePath;
  }

  for (const extension of SOURCE_EXTENSIONS) {
    const withExtension = `${basePath}${extension}`;
    if (fs.existsSync(withExtension)) return withExtension;
  }

  if (fs.existsSync(basePath) && fs.statSync(basePath).isDirectory()) {
    for (const extension of SOURCE_EXTENSIONS) {
      const asIndex = path.join(basePath, `index${extension}`);
      if (fs.existsSync(asIndex)) return asIndex;
    }
  }

  return null;
};

const resolveImport = (fromFile, specifier) => {
  if (specifier.startsWith(".")) {
    return resolveCandidateFile(path.resolve(path.dirname(fromFile), specifier));
  }

  if (specifier.startsWith("@/")) {
    return resolveCandidateFile(resolveAliasImport(specifier));
  }

  return null;
};

const collectAncestorLayouts = (pageFilePath) => {
  const result = [];
  let currentDir = path.dirname(pageFilePath);

  while (currentDir.startsWith(APP_DIR)) {
    for (const extension of SOURCE_EXTENSIONS) {
      const layoutPath = path.join(currentDir, `layout${extension}`);
      if (fs.existsSync(layoutPath)) {
        result.push(layoutPath);
        break;
      }
    }
    if (currentDir === APP_DIR) break;
    currentDir = path.dirname(currentDir);
  }

  return Array.from(new Set(result)).sort((left, right) => left.localeCompare(right));
};

const safeRelativeLine = (fileSource, offset) => {
  const lineStarts = [0];
  for (let index = 0; index < fileSource.length; index += 1) {
    if (fileSource[index] === "\n") {
      lineStarts.push(index + 1);
    }
  }
  let line = 0;
  while (line + 1 < lineStarts.length && lineStarts[line + 1] <= offset) {
    line += 1;
  }
  return line + 1;
};

const collectPatternMatches = (source, pattern) => {
  const matches = [];
  let match = pattern.exec(source);
  while (match) {
    const line = safeRelativeLine(source, match.index);
    matches.push({
      line,
      sample: match[0].slice(0, 160),
    });
    match = pattern.exec(source);
  }
  pattern.lastIndex = 0;
  return matches;
};

const analyzeFileSource = (source) => {
  const hasLocalCopy = LOCAL_COPY_PATTERNS.some((pattern) => pattern.test(source));
  const hasFallbackPl = FALLBACK_PL_PATTERN.test(source);
  const attributeMatches = collectPatternMatches(source, HARD_CODED_ATTRIBUTE_PATTERN);
  const toastMatches = collectPatternMatches(source, HARD_CODED_TOAST_PATTERN);
  const hardcodedMatches = [...attributeMatches, ...toastMatches].sort((left, right) => left.line - right.line);
  const hardcodedCount = hardcodedMatches.length;
  const score = hardcodedCount + (hasLocalCopy ? 6 : 0) + (hasFallbackPl ? 5 : 0);

  return {
    hasLocalCopy,
    hasFallbackPl,
    hardcodedCount,
    score,
    hardcodedSamples: hardcodedMatches.slice(0, 5),
  };
};

const isSharedFoundationFile = (filePath) => {
  const normalized = normalize(filePath);
  return SHARED_FOUNDATION_PATTERNS.some((pattern) => pattern.test(normalized));
};

const buildRouteReachability = (routePages, dependencyGraph) => {
  const result = new Map();

  for (const pageFile of routePages) {
    const visited = new Set([pageFile, ...collectAncestorLayouts(pageFile)]);
    const queue = [...visited];

    while (queue.length > 0) {
      const current = queue.shift();
      const imports = dependencyGraph.get(current) ?? [];
      for (const target of imports) {
        if (!target.startsWith(WEB_SRC_DIR)) continue;
        if (visited.has(target)) continue;
        visited.add(target);
        queue.push(target);
      }
    }

    result.set(pageFile, Array.from(visited).sort((left, right) => left.localeCompare(right)));
  }

  return result;
};

const run = () => {
  if (!fs.existsSync(WEB_SRC_DIR)) {
    throw new Error(`Missing web source directory: ${WEB_SRC_DIR}`);
  }

  const { outFile } = parseArgs();
  const sourceFiles = listSourceFiles(WEB_SRC_DIR);
  const routePages = sourceFiles.filter((filePath) => ROUTE_FILE_PATTERN.test(filePath));
  const sourceByFile = new Map();
  const dependencyGraph = new Map();
  const parserFailures = [];

  for (const filePath of sourceFiles) {
    const source = fs.readFileSync(filePath, "utf8");
    sourceByFile.set(filePath, source);
    const { imports, parseErrors } = readImports(filePath, source);
    if (parseErrors.length > 0) {
      parserFailures.push({
        filePath: toRelative(filePath),
        errors: parseErrors,
      });
      continue;
    }

    const resolvedImports = imports
      .map((specifier) => resolveImport(filePath, specifier))
      .filter((value) => value && value.startsWith(WEB_SRC_DIR));
    dependencyGraph.set(filePath, Array.from(new Set(resolvedImports)).sort((left, right) => left.localeCompare(right)));
  }

  if (parserFailures.length > 0) {
    const report = parserFailures
      .map(
        (entry) =>
          `${entry.filePath}\n${entry.errors.map((error) => `  - ${error}`).join("\n")}`
      )
      .join("\n");
    console.error("i18n route audit parser failure:");
    console.error(report);
    process.exit(1);
  }

  const routeReachability = buildRouteReachability(routePages, dependencyGraph);
  const reachableFiles = new Set();
  const routesByFile = new Map();

  for (const [routePage, files] of routeReachability.entries()) {
    for (const filePath of files) {
      reachableFiles.add(filePath);
      const current = routesByFile.get(filePath) ?? [];
      current.push(routePage);
      routesByFile.set(filePath, current);
    }
  }

  const fileFindings = Array.from(reachableFiles)
    .map((filePath) => {
      const source = sourceByFile.get(filePath);
      if (!source) {
        return null;
      }
      const analysis = analyzeFileSource(source);
      if (analysis.score === 0) return null;

      return {
        filePath: toRelative(filePath),
        isSharedFoundation: isSharedFoundationFile(filePath),
        hasLocalCopy: analysis.hasLocalCopy,
        hasFallbackPl: analysis.hasFallbackPl,
        hardcodedCount: analysis.hardcodedCount,
        score: analysis.score,
        hardcodedSamples: analysis.hardcodedSamples,
        routeReachableBy: (routesByFile.get(filePath) ?? [])
          .map((routePath) => toRelative(routePath))
          .sort((left, right) => left.localeCompare(right)),
      };
    })
    .filter(Boolean)
    .sort((left, right) => {
      if (right.score !== left.score) return right.score - left.score;
      return left.filePath.localeCompare(right.filePath);
    });

  const fileFindingByPath = new Map(fileFindings.map((item) => [item.filePath, item]));
  const routeFindings = Array.from(routeReachability.entries())
    .map(([routePage, files]) => {
      const issues = files
        .map((filePath) => fileFindingByPath.get(toRelative(filePath)))
        .filter(Boolean);
      const moduleIssues = issues.filter((item) => !item.isSharedFoundation);
      const sharedIssues = issues.filter((item) => item.isSharedFoundation);
      const moduleScore = moduleIssues.reduce((total, item) => total + item.score, 0);
      const sharedScore = sharedIssues.reduce((total, item) => total + item.score, 0);

      return {
        routePage: toRelative(routePage),
        reachableFilesCount: files.length,
        issueFilesCount: issues.length,
        moduleIssueFilesCount: moduleIssues.length,
        sharedIssueFilesCount: sharedIssues.length,
        score: {
          module: moduleScore,
          shared: sharedScore,
        },
        topModuleFiles: moduleIssues
          .sort((left, right) => {
            if (right.score !== left.score) return right.score - left.score;
            return left.filePath.localeCompare(right.filePath);
          })
          .slice(0, 5)
          .map((item) => ({
            filePath: item.filePath,
            score: item.score,
          })),
      };
    })
    .sort((left, right) => left.routePage.localeCompare(right.routePage));

  const output = {
    version: "1.0.0",
    generatedAtUtc: new Date().toISOString(),
    rootDir: toRelative(ROOT_DIR) || ".",
    scope: {
      scannedSourceFiles: sourceFiles.length,
      routePages: routePages.length,
      routeReachableFiles: reachableFiles.size,
    },
    summary: {
      filesWithFindings: fileFindings.length,
      filesWithLocalCopy: fileFindings.filter((item) => item.hasLocalCopy).length,
      filesWithFallbackPl: fileFindings.filter((item) => item.hasFallbackPl).length,
      filesWithHardcodedUiCandidates: fileFindings.filter((item) => item.hardcodedCount > 0).length,
      moduleFindingFiles: fileFindings.filter((item) => !item.isSharedFoundation).length,
      sharedFoundationFindingFiles: fileFindings.filter((item) => item.isSharedFoundation).length,
    },
    routeFindings,
    fileFindings,
  };

  fs.mkdirSync(path.dirname(outFile), { recursive: true });
  fs.writeFileSync(outFile, `${JSON.stringify(output, null, 2)}\n`, "utf8");

  console.log(`Route-reachable i18n audit written to ${toRelative(outFile)}.`);
  console.log(
    `Summary: findings=${output.summary.filesWithFindings}, localCopy=${output.summary.filesWithLocalCopy}, fallbackPl=${output.summary.filesWithFallbackPl}, hardcoded=${output.summary.filesWithHardcodedUiCandidates}.`
  );
};

try {
  run();
} catch (error) {
  console.error("[i18n-audit] failed:");
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
}
