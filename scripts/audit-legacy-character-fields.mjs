import { promises as fs } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, '..');
const srcRoot = path.join(repoRoot, 'src');

const TARGET_EXTENSIONS = new Set(['.ts', '.tsx']);

const ALLOWED_LEGACY_BOUNDARY_FILES = new Map([
  ['src/services/character/characterCompat.ts', '集中承载 corePersona/longTermMemoryProfile 的兼容兜底'],
  ['src/features/persistence/migrateCharacterShape.ts', '迁移旧角色字段到新结构'],
  ['src/features/import/importCompat.ts', '旧导入结构映射到新字段'],
  ['src/components/main/AddCharacterSheet.tsx', '创建/导入角色时同时写入 setting 与 corePersona'],
  ['src/components/main/MainAppShell/Page.tsx', '新好友桥接时保留传入旧字段值'],
  ['src/types.ts', '保留旧 schema 字段定义供兼容与迁移使用'],
  ['src/services/dream/dreamRuntimeTypes.ts', '梦境 runtime 旧 schema 字段兼容声明'],
]);

const LEGACY_PATTERNS = [
  {
    label: 'legacy-setting-read',
    regex: /\.\s*setting\b/g,
  },
  {
    label: 'legacy-memorySummary-read',
    regex: /\.\s*memorySummary\b/g,
  },
];

async function walkFiles(dir) {
  const entries = await fs.readdir(dir, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    const absolutePath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...await walkFiles(absolutePath));
      continue;
    }

    if (!TARGET_EXTENSIONS.has(path.extname(entry.name))) {
      continue;
    }

    files.push(absolutePath);
  }

  return files;
}

function stripBlockComments(source) {
  return source.replace(/\/\*[\s\S]*?\*\//g, '');
}

function collectFindings(relativePath, source) {
  const findings = [];
  const sanitized = stripBlockComments(source);
  const lines = sanitized.split(/\r?\n/);

  lines.forEach((line, index) => {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('//')) {
      return;
    }

    for (const pattern of LEGACY_PATTERNS) {
      let match;
      while ((match = pattern.regex.exec(line)) !== null) {
        findings.push({
          relativePath,
          line: index + 1,
          column: match.index + 1,
          label: pattern.label,
          excerpt: line.trim(),
        });
      }
      pattern.regex.lastIndex = 0;
    }
  });

  return findings;
}

function printAllowedBoundary() {
  console.log('Allowed legacy compatibility boundary:');
  for (const [relativePath, reason] of ALLOWED_LEGACY_BOUNDARY_FILES.entries()) {
    console.log(`- ${relativePath}: ${reason}`);
  }
}

async function main() {
  const files = await walkFiles(srcRoot);
  const disallowedFiles = files.filter((absolutePath) => {
    const relativePath = path.relative(repoRoot, absolutePath).replace(/\\/g, '/');
    return !ALLOWED_LEGACY_BOUNDARY_FILES.has(relativePath);
  });

  const findings = [];

  for (const absolutePath of disallowedFiles) {
    const relativePath = path.relative(repoRoot, absolutePath).replace(/\\/g, '/');
    const source = await fs.readFile(absolutePath, 'utf8');
    findings.push(...collectFindings(relativePath, source));
  }

  if (findings.length === 0) {
    console.log('Legacy character-field audit passed.');
    printAllowedBoundary();
    return;
  }

  console.error('Legacy character-field audit failed. Direct legacy field reads remain outside the approved compatibility boundary:\n');
  findings.forEach((finding) => {
    console.error(
      `- ${finding.relativePath}:${finding.line}:${finding.column} [${finding.label}] ${finding.excerpt}`,
    );
  });
  console.error('');
  printAllowedBoundary();
  process.exitCode = 1;
}

main().catch((error) => {
  console.error('Legacy character-field audit crashed:', error);
  process.exitCode = 1;
});
