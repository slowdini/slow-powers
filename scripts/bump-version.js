import { readFileSync, writeFileSync } from 'fs';

const version = process.argv[2];
if (!version || !/^\d+\.\d+\.\d+/.test(version)) {
  console.error('Usage: node bump-version.js <version>');
  process.exit(1);
}

const files = [
  'package.json',
  'packages/core/package.json',
  'packages/claude/package.json',
  'packages/codex/package.json',
  'packages/cursor/package.json',
  'packages/opencode/package.json',
  'packages/gemini/package.json',
  'packages/claude/plugin.json',
  'packages/claude/marketplace.json',
  'packages/codex/plugin.json',
  'packages/cursor/plugin.json',
  'packages/gemini/extension.json'
];

for (const file of files) {
  const content = JSON.parse(readFileSync(file, 'utf8'));
  content.version = version;
  writeFileSync(file, JSON.stringify(content, null, 2) + '\n');
  console.log(`Bumped ${file}`);
}
