#!/usr/bin/env bun
import { readFileSync, writeFileSync } from "node:fs";
import { VERSION_LOCKED_MANIFESTS } from "./manifest-files";

/**
 * Rewrites the `version` (and any `plugins[].version`) in each manifest, then
 * runs the result through biome so the output is byte-for-byte what `biome
 * check` produces. Without the biome pass, `JSON.stringify(_, null, 2)` explodes
 * short arrays one-element-per-line while biome collapses them — so every bump
 * would reintroduce a formatting diff the pre-commit hook then fights. Returns
 * the list of files that were actually updated.
 */
export function bumpFiles(files: readonly string[], version: string): string[] {
  const updatedFiles: string[] = [];

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
      updatedFiles.push(file);
      console.log(`Bumped ${file}`);
    } else {
      console.log(`Skipped ${file} (no version field)`);
    }
  }

  if (updatedFiles.length > 0) {
    formatWithBiome(updatedFiles);
  }

  return updatedFiles;
}

/**
 * Normalizes the given files with the project's biome so a version bump never
 * leaves a file in a state `biome check` would want to reformat. Fails loudly:
 * a silent skip would reintroduce the formatting drift this exists to prevent.
 */
function formatWithBiome(files: string[]): void {
  const result = Bun.spawnSync(
    ["bunx", "@biomejs/biome", "format", "--write", ...files],
    { stdout: "pipe", stderr: "pipe" },
  );
  if (result.exitCode !== 0) {
    console.error(result.stderr.toString());
    throw new Error(
      `biome formatting failed (exit ${result.exitCode}); manifests may be left in a non-canonical format`,
    );
  }
}

if (import.meta.main) {
  const version = process.argv[2];
  if (!version || !/^\d+\.\d+\.\d+/.test(version)) {
    console.error("Usage: bun scripts/bump-version.ts <version>");
    process.exit(1);
  }
  bumpFiles(VERSION_LOCKED_MANIFESTS, version);
}
