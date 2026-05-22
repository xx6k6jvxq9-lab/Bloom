import { promises as fs } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, '..');

const TARGET_EXTENSIONS = new Set(['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs']);
const SKIPPED_DIRECTORY_NAMES = new Set([
  '.git',
  'node_modules',
  'dist',
  'test-dist',
  '.codex-temp',
  '.codex-test-out',
]);
const SKIPPED_RELATIVE_PATHS = new Set([
  'scripts/check-legacy-regex.mjs',
]);
const SCAN_ROOTS = [
  'src',
  'app',
  'functions',
  'scripts',
  'server.ts',
  'vite.config.ts',
];

const FORBIDDEN_REGEX_PATTERNS = [
  {
    label: 'lookbehind-or-named-capture',
    regex: /\(\?</g,
    reason: 'lookbehind and named capture groups are outside the Safari/iOS WebView compatibility boundary.',
  },
  {
    label: 'named-backreference',
    regex: /\\k</g,
    reason: 'named backreferences depend on named capture groups, which are outside the Safari/iOS WebView compatibility boundary.',
  },
];

async function pathExists(absolutePath) {
  try {
    await fs.access(absolutePath);
    return true;
  } catch {
    return false;
  }
}

async function walkEntry(absolutePath) {
  const stat = await fs.stat(absolutePath);

  if (stat.isDirectory()) {
    const directoryName = path.basename(absolutePath);
    if (SKIPPED_DIRECTORY_NAMES.has(directoryName)) {
      return [];
    }

    const entries = await fs.readdir(absolutePath, { withFileTypes: true });
    const files = [];

    for (const entry of entries) {
      files.push(...await walkEntry(path.join(absolutePath, entry.name)));
    }

    return files;
  }

  if (!TARGET_EXTENSIONS.has(path.extname(absolutePath))) {
    return [];
  }

  const relativePath = path.relative(repoRoot, absolutePath).replace(/\\/g, '/');
  if (SKIPPED_RELATIVE_PATHS.has(relativePath)) {
    return [];
  }

  return [absolutePath];
}

function stripBlockComments(source) {
  return source.replace(/\/\*[\s\S]*?\*\//g, '');
}

function collectFindings(relativePath, source) {
  const sanitized = stripBlockComments(source);
  const lines = sanitized.split(/\r?\n/);
  const findings = [];

  lines.forEach((line, index) => {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('//')) {
      return;
    }

    for (const pattern of FORBIDDEN_REGEX_PATTERNS) {
      let match;
      while ((match = pattern.regex.exec(line)) !== null) {
        findings.push({
          relativePath,
          line: index + 1,
          column: match.index + 1,
          label: pattern.label,
          reason: pattern.reason,
          excerpt: trimmed,
        });
      }
      pattern.regex.lastIndex = 0;
    }
  });

  return findings;
}

function printBoundary() {
  console.log('Regex compatibility boundary:');
  console.log('- Current build targets still include safari >= 11 and iOS >= 11.');
  console.log('- Do not use lookbehind, named capture groups, or named backreferences.');
  console.log('- Prefer capture-group rewrites, delimiter insertion before split, or plain character scanning.');
}

async function main() {
  const files = [];

  for (const scanRoot of SCAN_ROOTS) {
    const absolutePath = path.join(repoRoot, scanRoot);
    if (!await pathExists(absolutePath)) {
      continue;
    }

    files.push(...await walkEntry(absolutePath));
  }

  const findings = [];

  for (const absolutePath of files) {
    const relativePath = path.relative(repoRoot, absolutePath).replace(/\\/g, '/');
    const source = await fs.readFile(absolutePath, 'utf8');
    findings.push(...collectFindings(relativePath, source));
  }

  if (findings.length === 0) {
    console.log('Legacy regex compatibility audit passed.');
    printBoundary();
    return;
  }

  console.error('Legacy regex compatibility audit failed. Unsupported regex syntax was found:\n');
  findings.forEach((finding) => {
    console.error(
      `- ${finding.relativePath}:${finding.line}:${finding.column} [${finding.label}] ${finding.excerpt}`,
    );
    console.error(`  ${finding.reason}`);
  });
  console.error('');
  printBoundary();
  process.exitCode = 1;
}

main().catch((error) => {
  console.error('Legacy regex compatibility audit crashed:', error);
  process.exitCode = 1;
});
