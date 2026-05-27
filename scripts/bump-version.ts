#!/usr/bin/env bun
import { readFileSync, writeFileSync } from "node:fs";
import { VERSION_LOCKED_MANIFESTS } from "./manifest-files";

const version = process.argv[2];
if (!version || !/^\d+\.\d+\.\d+/.test(version)) {
  console.error("Usage: bun scripts/bump-version.ts <version>");
  process.exit(1);
}

for (const file of VERSION_LOCKED_MANIFESTS) {
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
