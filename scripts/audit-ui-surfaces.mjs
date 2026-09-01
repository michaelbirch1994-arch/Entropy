import { promises as fs } from "node:fs";
import path from "node:path";
import process from "node:process";

const root = process.cwd();
const srcDir = path.join(root, "src");

const SIGNALS = [
  { key: "buttons", pattern: /<button\b/g },
  { key: "inputs", pattern: /<(input|textarea|select)\b/g },
  { key: "tables", pattern: /<table\b/g },
  { key: "nativeDetails", pattern: /<details\b/g },
  { key: "ariaAttributes", pattern: /\baria-[\w-]+=/g },
  { key: "roleAttributes", pattern: /\brole=/g },
  { key: "titleTooltips", pattern: /\btitle=/g },
  { key: "motionUsage", pattern: /\bmotion\.|AnimatePresence|framer-motion/g },
  { key: "transitionClasses", pattern: /\btransition(?:-[\w[\]/.:-]+)?\b/g },
  { key: "durationClasses", pattern: /\bduration-[\w[\]/.:-]+\b/g },
  { key: "hardCodedHexColors", pattern: /#[0-9a-fA-F]{3,8}\b/g },
  { key: "rawSlateTailwind", pattern: /\b(?:text|bg|border)-slate-\d{2,3}\b/g },
  { key: "rawRoundedLarge", pattern: /\brounded-(?:xl|2xl|3xl|full)\b/g },
];

async function main() {
  const files = await listFiles(srcDir);
  const sourceFiles = files.filter(
    (file) => /\.(tsx?|css)$/.test(file) && !file.includes(`${path.sep}__tests__${path.sep}`) && !/\.test\.[tj]sx?$/.test(file),
  );
  const records = await Promise.all(sourceFiles.map(readSurfaceFile));
  const appSource = await fs.readFile(path.join(srcDir, "App.tsx"), "utf8");
  const registrySource = await fs.readFile(path.join(srcDir, "lib", "viewRegistry.ts"), "utf8");

  const lazyViews = [...appSource.matchAll(/const\s+(\w+)\s*=\s*lazy\(\(\)\s*=>\s*import\("([^"]+)"\)\)/g)].map((match) => ({
    component: match[1],
    importPath: match[2],
  }));
  const routedViews = [...appSource.matchAll(/case\s+"([^"]+)":\s*return\s*<([^ />;]+)/g)].map((match) => ({
    id: match[1],
    component: match[2],
  }));
  const sidebarViews = [...registrySource.matchAll(/\{\s*id:\s*"([^"]+)",\s*label:\s*"([^"]+)"/g)].map((match) => ({
    id: match[1],
    label: match[2],
  }));

  const totals = {};
  for (const signal of SIGNALS) {
    totals[signal.key] = records.reduce((sum, record) => sum + record.signals[signal.key], 0);
  }

  const highSignalFiles = Object.fromEntries(
    SIGNALS.map((signal) => [
      signal.key,
      records
        .filter((record) => record.signals[signal.key] > 0)
        .sort((a, b) => b.signals[signal.key] - a.signals[signal.key])
        .slice(0, 10)
        .map((record) => ({ file: relative(record.file), count: record.signals[signal.key] })),
    ]),
  );

  const result = {
    generatedAt: new Date().toISOString(),
    sourceRoot: root,
    summary: {
      sourceFiles: sourceFiles.length,
      viewFiles: records.filter((record) => record.file.includes(`${path.sep}views${path.sep}`)).length,
      uiComponentFiles: records.filter((record) => record.file.includes(`${path.sep}components${path.sep}`)).length,
      stylesheetFiles: records.filter((record) => record.file.endsWith(".css")).length,
      lazyViews: lazyViews.length,
      routedViews: routedViews.length,
      sidebarViews: sidebarViews.length,
      unroutedLazyComponents: lazyViews
        .map((view) => view.component)
        .filter((component) => !routedViews.some((route) => route.component === component)),
      sidebarViewsWithoutRoutes: sidebarViews
        .map((view) => view.id)
        .filter((id) => !routedViews.some((route) => route.id === id)),
      routesWithoutSidebarEntries: routedViews
        .map((route) => route.id)
        .filter((id) => !sidebarViews.some((view) => view.id === id)),
    },
    totals,
    lazyViews,
    routedViews,
    sidebarViews,
    highSignalFiles,
  };

  if (process.argv.includes("--markdown")) {
    process.stdout.write(renderMarkdown(result));
  } else {
    process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
  }
}

async function listFiles(dir) {
  const entries = await fs.readdir(dir, { withFileTypes: true });
  const files = await Promise.all(
    entries.map((entry) => {
      const fullPath = path.join(dir, entry.name);
      return entry.isDirectory() ? listFiles(fullPath) : fullPath;
    }),
  );
  return files.flat();
}

async function readSurfaceFile(file) {
  const source = await fs.readFile(file, "utf8");
  return {
    file,
    lines: source.split(/\r?\n/).length,
    signals: Object.fromEntries(SIGNALS.map((signal) => [signal.key, matchCount(source, signal.pattern)])),
  };
}

function matchCount(source, pattern) {
  return [...source.matchAll(pattern)].length;
}

function relative(file) {
  return path.relative(root, file).replaceAll(path.sep, "/");
}

function renderMarkdown(result) {
  return [
    "# Entropy UI Surface Inventory",
    "",
    `Generated: ${result.generatedAt}`,
    "",
    "## Summary",
    "",
    ...Object.entries(result.summary).map(([key, value]) => `- ${key}: ${Array.isArray(value) ? value.join(", ") || "none" : value}`),
    "",
    "## UI Pattern Totals",
    "",
    ...Object.entries(result.totals).map(([key, value]) => `- ${key}: ${value}`),
    "",
    "## Highest Signal Files",
    "",
    ...Object.entries(result.highSignalFiles).flatMap(([key, files]) => [
      `### ${key}`,
      "",
      ...(files.length ? files.map((file) => `- ${file.file}: ${file.count}`) : ["- none"]),
      "",
    ]),
  ].join("\n");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
