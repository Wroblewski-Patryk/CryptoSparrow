#!/usr/bin/env node

import { readdir, readFile, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';

const repoRoot = process.cwd();

const parseArgs = () => {
  const args = process.argv.slice(2);
  const options = {
    json: false,
    output: '',
    help: false,
  };

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (arg === '--help' || arg === '-h') {
      options.help = true;
      continue;
    }
    if (arg === '--json') {
      options.json = true;
      continue;
    }
    if (arg === '--output') {
      options.output = args[index + 1] ?? '';
      index += 1;
    }
  }

  if (options.output) {
    options.output = path.resolve(repoRoot, options.output);
  }

  return options;
};

const toPosixPath = (value) => value.split(path.sep).join('/');

const directoryExists = async (targetPath) => {
  try {
    const entry = await stat(targetPath);
    return entry.isDirectory();
  } catch {
    return false;
  }
};

const fileExists = async (targetPath) => {
  try {
    const entry = await stat(targetPath);
    return entry.isFile();
  } catch {
    return false;
  }
};

const listDirectoryNames = async (targetPath) => {
  const entries = await readdir(targetPath, { withFileTypes: true });
  return entries
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort((a, b) => a.localeCompare(b));
};

const collectPageFiles = async (rootDir) => {
  const stack = [rootDir];
  const pageFiles = [];

  while (stack.length > 0) {
    const current = stack.pop();
    const entries = await readdir(current, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(current, entry.name);
      if (entry.isDirectory()) {
        stack.push(fullPath);
        continue;
      }
      if (entry.isFile() && entry.name === 'page.tsx') {
        pageFiles.push(fullPath);
      }
    }
  }

  return pageFiles.sort((a, b) => a.localeCompare(b));
};

const normalizeRouteFromPage = (appRoot, pageFile) => {
  const relative = path.relative(appRoot, pageFile);
  const segments = relative.split(path.sep);

  if (segments.length === 0) return '/';
  if (segments[segments.length - 1] === 'page.tsx') {
    segments.pop();
  }

  const visibleSegments = segments
    .filter((segment) => !(segment.startsWith('(') && segment.endsWith(')')))
    .map((segment) =>
      segment.startsWith('[') && segment.endsWith(']') ? `:${segment.slice(1, -1)}` : segment
    );

  if (visibleSegments.length === 0) {
    return '/';
  }

  return `/${visibleSegments.join('/')}`;
};

const parseModuleRows = (raw) => {
  const rows = [];
  for (const line of raw.split(/\r?\n/)) {
    const match = line.match(
      /^\|\s*(api|web)\s*\|\s*([^|]+?)\s*\|\s*`([^`]+)`\s*\|\s*`([^`]+)`\s*\|\s*([^|]+?)\s*\|\s*([^|]+?)\s*\|$/
    );
    if (!match) continue;
    rows.push({
      layer: match[1].trim(),
      module: match[2].trim(),
      sourcePath: match[3].trim(),
      targetDocPath: match[4].trim(),
      status: match[5].trim(),
      plannedTask: match[6].trim(),
    });
  }
  return rows;
};

const parseCanonicalRoutes = (raw) => {
  const routes = [];
  let inCanonicalInventory = false;

  for (const line of raw.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (trimmed === '## Canonical Web Route Inventory (V1)') {
      inCanonicalInventory = true;
      continue;
    }
    if (inCanonicalInventory && trimmed.startsWith('## ')) {
      break;
    }
    if (!inCanonicalInventory || !trimmed.startsWith('- `')) {
      continue;
    }
    const route = trimmed.slice(3, trimmed.lastIndexOf('`')).trim();
    if (route.length > 0) {
      routes.push(route);
    }
  }

  return [...new Set(routes)].sort((a, b) => a.localeCompare(b));
};

const collectMissing = (source, targetSet) => source.filter((item) => !targetSet.has(item));

const main = async () => {
  const options = parseArgs();
  if (options.help) {
    console.log('Usage: node scripts/checkDocsParity.mjs [--json] [--output <file>]');
    process.exit(0);
  }

  const moduleIndexPath = path.resolve(repoRoot, 'docs', 'modules', 'module-doc-status-index.md');
  const routeMapPath = path.resolve(repoRoot, 'docs', 'architecture', 'dashboard-route-map.md');
  const apiModulesPath = path.resolve(repoRoot, 'apps', 'api', 'src', 'modules');
  const webFeaturesPath = path.resolve(repoRoot, 'apps', 'web', 'src', 'features');
  const webAppPath = path.resolve(repoRoot, 'apps', 'web', 'src', 'app');

  const [rawModuleIndex, rawRouteMap] = await Promise.all([
    readFile(moduleIndexPath, 'utf8'),
    readFile(routeMapPath, 'utf8'),
  ]);

  const moduleRows = parseModuleRows(rawModuleIndex);
  const apiRows = moduleRows.filter((row) => row.layer === 'api');
  const webRows = moduleRows.filter((row) => row.layer === 'web');

  const [apiModulesOnDisk, webFeaturesOnDisk, pageFiles] = await Promise.all([
    listDirectoryNames(apiModulesPath),
    listDirectoryNames(webFeaturesPath),
    collectPageFiles(webAppPath),
  ]);

  const routesOnDisk = [...new Set(pageFiles.map((file) => normalizeRouteFromPage(webAppPath, file)))].sort((a, b) =>
    a.localeCompare(b)
  );
  const canonicalRoutes = parseCanonicalRoutes(rawRouteMap);

  const apiDocModules = apiRows.map((row) => row.module).sort((a, b) => a.localeCompare(b));
  const webDocModules = webRows.map((row) => row.module).sort((a, b) => a.localeCompare(b));

  const apiModulesOnDiskSet = new Set(apiModulesOnDisk);
  const webFeaturesOnDiskSet = new Set(webFeaturesOnDisk);
  const apiDocModulesSet = new Set(apiDocModules);
  const webDocModulesSet = new Set(webDocModules);
  const routesOnDiskSet = new Set(routesOnDisk);
  const canonicalRoutesSet = new Set(canonicalRoutes);

  const mismatches = {
    apiModulesMissingInDocs: collectMissing(apiModulesOnDisk, apiDocModulesSet),
    apiModulesStaleInDocs: collectMissing(apiDocModules, apiModulesOnDiskSet),
    webFeaturesMissingInDocs: collectMissing(webFeaturesOnDisk, webDocModulesSet),
    webFeaturesStaleInDocs: collectMissing(webDocModules, webFeaturesOnDiskSet),
    routesMissingInDocs: collectMissing(routesOnDisk, canonicalRoutesSet),
    routesStaleInDocs: collectMissing(canonicalRoutes, routesOnDiskSet),
    sourcePathMismatches: [],
    missingPublishedDeepDiveDocs: [],
  };

  for (const row of moduleRows) {
    const expectedSourcePath =
      row.layer === 'api' ? `apps/api/src/modules/${row.module}` : `apps/web/src/features/${row.module}`;
    if (row.sourcePath !== expectedSourcePath) {
      mismatches.sourcePathMismatches.push({
        layer: row.layer,
        module: row.module,
        expectedSourcePath,
        documentedSourcePath: row.sourcePath,
      });
    }

    if (row.status === 'Published') {
      const docPath = path.resolve(repoRoot, row.targetDocPath);
      const publishedDocExists = await fileExists(docPath);
      if (!publishedDocExists) {
        mismatches.missingPublishedDeepDiveDocs.push({
          layer: row.layer,
          module: row.module,
          targetDocPath: row.targetDocPath,
        });
      }
    }
  }

  const hasFailures = Object.values(mismatches).some((bucket) => bucket.length > 0);

  const result = {
    generatedAt: new Date().toISOString(),
    status: hasFailures ? 'FAIL' : 'PASS',
    counts: {
      apiModulesOnDisk: apiModulesOnDisk.length,
      apiModulesDocumented: apiDocModules.length,
      webFeaturesOnDisk: webFeaturesOnDisk.length,
      webFeaturesDocumented: webDocModules.length,
      routesOnDisk: routesOnDisk.length,
      routesDocumented: canonicalRoutes.length,
    },
    mismatches,
  };

  if (options.output) {
    const outputDir = path.dirname(options.output);
    if (!(await directoryExists(outputDir))) {
      throw new Error(`Output directory does not exist: ${toPosixPath(path.relative(repoRoot, outputDir))}`);
    }
    await writeFile(options.output, `${JSON.stringify(result, null, 2)}\n`, 'utf8');
  }

  if (options.json) {
    console.log(JSON.stringify(result, null, 2));
  } else {
    console.log(`Docs parity status: ${result.status}`);
    console.log(
      `Inventory counts => API: ${result.counts.apiModulesOnDisk}/${result.counts.apiModulesDocumented}, Web: ${result.counts.webFeaturesOnDisk}/${result.counts.webFeaturesDocumented}, Routes: ${result.counts.routesOnDisk}/${result.counts.routesDocumented}`
    );

    const lines = [
      ['apiModulesMissingInDocs', 'API modules missing in docs'],
      ['apiModulesStaleInDocs', 'API modules stale in docs'],
      ['webFeaturesMissingInDocs', 'Web features missing in docs'],
      ['webFeaturesStaleInDocs', 'Web features stale in docs'],
      ['routesMissingInDocs', 'Routes missing in docs'],
      ['routesStaleInDocs', 'Routes stale in docs'],
      ['sourcePathMismatches', 'Source path mismatches'],
      ['missingPublishedDeepDiveDocs', 'Missing published deep-dive docs'],
    ];

    for (const [key, label] of lines) {
      const issues = mismatches[key];
      if (issues.length === 0) {
        console.log(`- ${label}: OK`);
        continue;
      }
      console.log(`- ${label}: ${issues.length}`);
      for (const issue of issues) {
        if (typeof issue === 'string') {
          console.log(`  * ${issue}`);
          continue;
        }
        console.log(`  * ${JSON.stringify(issue)}`);
      }
    }
  }

  if (hasFailures) {
    process.exit(1);
  }
};

main().catch((error) => {
  console.error(`docs parity check failed: ${error instanceof Error ? error.message : String(error)}`);
  process.exit(1);
});
