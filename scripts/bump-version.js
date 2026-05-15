import { readFileSync, writeFileSync } from "node:fs";

const version = process.argv[2];
if (!version || !/^\d+\.\d+\.\d+/.test(version)) {
  console.error("Usage: node bump-version.js <version>");
  process.exit(1);
}

const files = [
  "package.json",
  "packages/core/package.json",
  "packages/claude/package.json",
  "packages/codex/package.json",
  "packages/cursor/package.json",
  "packages/opencode/package.json",
  "packages/claude/plugin.json",
  "packages/codex/plugin.json",
  "packages/cursor/.cursor-plugin/plugin.json",
  "extension.json",
  "marketplace.json",
  ".agents/plugins/marketplace.json",
];

for (const file of files) {
  const content = JSON.parse(readFileSync(file, "utf8"));
  let updated = false;

  if (content.version !== undefined) {
    content.version = version;
    updated = true;
  }

  if (Array.isArray(content.plugins)) {
    for (const plugin of content.plugins) {
      if (plugin.version !== undefined) {
        plugin.version = version;
        updated = true;
      }
    }
  }

  if (updated) {
    writeFileSync(file, `${JSON.stringify(content, null, 2)}\n`);
    console.log(`Bumped ${file}`);
  } else {
    console.log(`Skipped ${file} (no version field)`);
  }
}
