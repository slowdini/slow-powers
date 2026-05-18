import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const [, , repoRoot, packJsonPath] = process.argv;

if (!repoRoot || !packJsonPath) {
  console.error('Usage: node test-core-paths.mjs REPO_ROOT PACK_JSON_PATH');
  process.exit(2);
}

const rootPackageJson = JSON.parse(
  fs.readFileSync(path.join(repoRoot, 'package.json'), 'utf8'),
);
const packResult = JSON.parse(fs.readFileSync(packJsonPath, 'utf8'))[0];
const packedFiles = new Set(packResult.files.map((file) => file.path));

assert.equal(rootPackageJson.name, '@slowdini/superslow-opencode', 'root package name should be @slowdini/superslow-opencode');
assert.equal(rootPackageJson.private, true, 'root package should stay private');
assert.equal(
  rootPackageJson.main,
  './opencode/plugins/superpowers.js',
  'root package should point main to opencode plugin',
);
assert.equal(
  Object.hasOwn(rootPackageJson.scripts ?? {}, 'publish:all'),
  false,
  'root package should no longer advertise publish:all',
);
assert.equal(
  Object.hasOwn(rootPackageJson.scripts ?? {}, 'prepare'),
  false,
  'root package should not run contributor-only prepare hooks during git install',
);

assert.equal(packedFiles.has('package.json'), true, 'packed root package.json should be present');
assert.equal(packedFiles.has('README.md'), true, 'packed README should be present');
assert.equal(packedFiles.has('LICENSE'), true, 'packed LICENSE should be present');
assert.equal(
  packedFiles.has('opencode/plugins/superpowers.js'),
  true,
  'packed plugin entry should be present',
);
assert.equal(
  packedFiles.has('bootstrap.md'),
  true,
  'packed bootstrap.md should be present',
);
assert.equal(
  packedFiles.has('opencode/package.json'),
  false,
  'internal OpenCode workspace metadata should not ship in the root artifact',
);
assert.equal(
  packedFiles.has('gemini-extension.json'),
  false,
  'Gemini files should stay out of the OpenCode root package artifact',
);
assert.equal(
  packedFiles.has('tests/opencode/test-plugin-loading.sh'),
  false,
  'OpenCode tests should not ship in the root artifact',
);
