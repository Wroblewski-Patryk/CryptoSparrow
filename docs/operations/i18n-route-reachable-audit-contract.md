# Route-Reachable i18n Audit Contract

## Command
- `pnpm i18n:audit:route-reachable:web`
- Optional output override:
  - `pnpm i18n:audit:route-reachable:web -- --out docs/operations/_artifacts-custom.json`

## Exit Semantics
- `0`: audit completed and JSON artifact written.
- non-zero: argument error, filesystem error, or parser failure.
- Parser failure contract:
  - if any scanned source file has parse diagnostics, command prints file + diagnostics and exits non-zero.

## Output File (JSON)
Default output path:
- `docs/operations/_artifacts-l10nq-d-coverage-audit-latest.json`

Top-level schema:
```json
{
  "version": "1.0.0",
  "generatedAtUtc": "ISO-8601",
  "rootDir": "string",
  "scope": {
    "scannedSourceFiles": 0,
    "routePages": 0,
    "routeReachableFiles": 0
  },
  "summary": {
    "filesWithFindings": 0,
    "filesWithLocalCopy": 0,
    "filesWithFallbackPl": 0,
    "filesWithHardcodedUiCandidates": 0,
    "moduleFindingFiles": 0,
    "sharedFoundationFindingFiles": 0
  },
  "routeFindings": [],
  "fileFindings": []
}
```

`routeFindings[]` item contract:
- `routePage`: route page file path.
- `reachableFilesCount`: number of transitive route-reachable files (including ancestor layouts).
- `issueFilesCount`: number of reachable files with finding score > 0.
- `moduleIssueFilesCount`: issue files outside shared foundation bucket.
- `sharedIssueFilesCount`: issue files in shared foundation bucket.
- `score.module`, `score.shared`: aggregate score split.
- `topModuleFiles[]`: highest-score module files with `filePath` and `score`.

`fileFindings[]` item contract:
- `filePath`: route-reachable source file path.
- `isSharedFoundation`: shared vs module split flag.
- `hasLocalCopy`: local dictionary indicator (`copy`/locale-map style).
- `hasFallbackPl`: locale fallback drift indicator (`?? 'pl'`, `|| 'pl'`, `locale === 'pl'`).
- `hardcodedCount`: monitored hardcoded UI string candidates count.
- `score`: weighted score (`hardcoded + localCopy + fallbackPl` weighting).
- `hardcodedSamples[]`: first matched samples with `line` and `sample`.
- `routeReachableBy[]`: routes that reach this file.

## Determinism Rules
- Source file enumeration is lexicographically sorted.
- Route findings are sorted by `routePage`.
- File findings are sorted by `score DESC`, then `filePath ASC`.
- Route-reachability includes route page, ancestor layouts, and transitive imports resolved from `./`, `../`, and `@/` paths.
