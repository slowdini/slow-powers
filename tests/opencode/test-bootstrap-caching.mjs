import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const [, , pluginPath, scenario] = process.argv;
const supportedScenarios = ['present', 'missing-file', 'missing-skills-dir'];
const bootstrapMarker = 'SUPERSLOW_OPENCODE_BOOTSTRAP';

if (!pluginPath || !supportedScenarios.includes(scenario)) {
  console.error(
    'Usage: node test-bootstrap-caching.mjs PLUGIN_PATH present|missing-file|missing-skills-dir'
  );
  process.exit(2);
}

const expectedSkillsDir = path.resolve(path.dirname(pluginPath), '../../skills');
const expectedUsingSuperpowersSkillPath = path.join(
  expectedSkillsDir,
  'using-superpowers',
  'SKILL.md'
);

let existsCount = 0;
let readCount = 0;

const originalExistsSync = fs.existsSync;
const originalReadFileSync = fs.readFileSync;

fs.existsSync = function (...args) {
  if (normalizePath(args[0]) === normalizePath(expectedUsingSuperpowersSkillPath)) {
    existsCount += 1;
  }
  return originalExistsSync.apply(this, args);
};

fs.readFileSync = function (...args) {
  if (normalizePath(args[0]) === normalizePath(expectedUsingSuperpowersSkillPath)) {
    readCount += 1;
  }
  return originalReadFileSync.apply(this, args);
};

const pluginSource = originalReadFileSync(pluginPath, 'utf8');
const mod = await import(pathToFileURL(pluginPath).href);
const plugin = await mod.SuperpowersPlugin({ client: {}, directory: '.' });
const config = {};
await plugin.config(config);
const transform = plugin['experimental.chat.messages.transform'];

const firstOutput = makeOutput(`${scenario} bootstrap first step`);
await transform({}, firstOutput);
const afterFirst = { existsCount, readCount };

const secondOutput = makeOutput(`${scenario} bootstrap second step`);
await transform({}, secondOutput);
const afterSecond = { existsCount, readCount };

const sameOutput = makeOutput(`user prompt mentions EXTREMELY_IMPORTANT`, {
  type: 'text',
  text: 'user prompt mentions EXTREMELY_IMPORTANT',
  testOnlyField: 'should-not-be-copied',
});
await transform({}, sameOutput);
const sameOutputBootstrapPartsAfterFirst = countBootstrapParts(sameOutput);
const sameOutputFirstPart = sameOutput.messages[0].parts[0];
await transform({}, sameOutput);
const sameOutputBootstrapPartsAfterSecond = countBootstrapParts(sameOutput);

const result = {
  scenario,
  expectedSkillsDir,
  expectedUsingSuperpowersSkillPath,
  pluginStillReferencesCorePaths: pluginSource.includes('@slowdini/superslow-core/paths'),
  registeredSkillsPaths: config.skills?.paths ?? [],
  firstBootstrapParts: countBootstrapParts(firstOutput),
  secondBootstrapParts: countBootstrapParts(secondOutput),
  firstReadCount: afterFirst.readCount,
  secondReadCount: afterSecond.readCount,
  firstExistsCount: afterFirst.existsCount,
  secondExistsCount: afterSecond.existsCount,
  sameOutputBootstrapPartsAfterFirst,
  sameOutputBootstrapPartsAfterSecond,
  sameOutputFirstPartKeys: Object.keys(sameOutputFirstPart).sort(),
  sameOutputFirstPartText: sameOutputFirstPart?.text,
  sameOutputFirstPartInheritedField: sameOutputFirstPart?.testOnlyField,
};

const failures = [
  ...assertRepoRelativePluginSource(result),
  ...(scenario === 'present'
    ? assertPresentBootstrap(result)
    : scenario === 'missing-file'
      ? assertMissingFileBootstrap(result)
      : assertMissingSkillsDirBootstrap(result)),
];

if (failures.length > 0) {
  console.error(JSON.stringify(result, null, 2));
  for (const failure of failures) {
    console.error(`FAIL: ${failure}`);
  }
  process.exit(1);
}

console.log(JSON.stringify(result, null, 2));

function normalizePath(filePath) {
  return String(filePath).replaceAll('\\', '/').replace(/^\/private/, '');
}

function makeOutput(text, firstPart = { type: 'text', text }) {
  return {
    messages: [{
      info: { role: 'user' },
      parts: [firstPart],
    }],
  };
}

function countBootstrapParts(output) {
  return output.messages[0].parts.filter(
    (part) => part.type === 'text' && part.text.includes(bootstrapMarker)
  ).length;
}

function assertRepoRelativePluginSource(result) {
  return result.pluginStillReferencesCorePaths
    ? ['expected plugin source to stop referencing @slowdini/superslow-core/paths']
    : [];
}

function assertPresentBootstrap(result) {
  const failures = [];

  if (
    JSON.stringify(result.registeredSkillsPaths.map(normalizePath)) !==
    JSON.stringify([expectedSkillsDir].map(normalizePath))
  ) {
    failures.push(
      `expected config hook to register ${JSON.stringify([expectedSkillsDir])}, got ${JSON.stringify(result.registeredSkillsPaths)}`
    );
  }
  if (result.firstBootstrapParts !== 1) {
    failures.push(`expected first transform to inject one bootstrap part, got ${result.firstBootstrapParts}`);
  }
  if (result.secondBootstrapParts !== 1) {
    failures.push(`expected second transform to inject one bootstrap part, got ${result.secondBootstrapParts}`);
  }
  if (result.firstReadCount !== 1) {
    failures.push(`expected first transform to read SKILL.md once, got ${result.firstReadCount}`);
  }
  if (result.secondReadCount !== result.firstReadCount) {
    failures.push(`expected cached second transform to do no additional reads, got ${result.secondReadCount - result.firstReadCount}`);
  }
  if (result.secondExistsCount !== result.firstExistsCount) {
    failures.push(`expected cached second transform to do no additional exists checks, got ${result.secondExistsCount - result.firstExistsCount}`);
  }
  if (result.sameOutputBootstrapPartsAfterFirst !== 1) {
    failures.push(`expected user text containing EXTREMELY_IMPORTANT to still receive bootstrap injection, got ${result.sameOutputBootstrapPartsAfterFirst}`);
  }
  if (result.sameOutputBootstrapPartsAfterSecond !== 1) {
    failures.push(`expected repeat transform on same output to avoid duplicate bootstrap injection, got ${result.sameOutputBootstrapPartsAfterSecond}`);
  }
  if (JSON.stringify(result.sameOutputFirstPartKeys) !== JSON.stringify(['text', 'type'])) {
    failures.push(`expected injected bootstrap part to contain only type/text keys, got ${JSON.stringify(result.sameOutputFirstPartKeys)}`);
  }
  if (result.sameOutputFirstPartInheritedField !== undefined) {
    failures.push('expected injected bootstrap part to avoid inheriting extra fields from the original first part');
  }
  if (typeof result.sameOutputFirstPartText !== 'string' || !result.sameOutputFirstPartText.includes(bootstrapMarker)) {
    failures.push('expected injected bootstrap part to contain the plugin-specific bootstrap marker');
  }

  return failures;
}

function assertMissingFileBootstrap(result) {
  const failures = [];

  if (
    JSON.stringify(result.registeredSkillsPaths.map(normalizePath)) !==
    JSON.stringify([expectedSkillsDir].map(normalizePath))
  ) {
    failures.push(
      `expected config hook to register ${JSON.stringify([expectedSkillsDir])}, got ${JSON.stringify(result.registeredSkillsPaths)}`
    );
  }
  if (result.firstBootstrapParts !== 0) {
    failures.push(`expected no bootstrap when SKILL.md is missing, got ${result.firstBootstrapParts}`);
  }
  if (result.secondBootstrapParts !== 0) {
    failures.push(`expected no bootstrap on second missing-file transform, got ${result.secondBootstrapParts}`);
  }
  if (result.firstReadCount !== 0 || result.secondReadCount !== 0) {
    failures.push(`expected missing file path to avoid reads, got ${result.secondReadCount}`);
  }
  if (result.firstExistsCount !== 1) {
    failures.push(`expected missing file path to be checked once, got ${result.firstExistsCount}`);
  }
  if (result.secondExistsCount !== result.firstExistsCount) {
    failures.push(`expected missing-file result to be cached, got ${result.secondExistsCount - result.firstExistsCount} extra exists checks`);
  }

  return failures;
}

function assertMissingSkillsDirBootstrap(result) {
  const failures = [];

  if (JSON.stringify(result.registeredSkillsPaths) !== JSON.stringify([])) {
    failures.push(`expected config hook to register [], got ${JSON.stringify(result.registeredSkillsPaths)}`);
  }
  if (result.firstBootstrapParts !== 0) {
    failures.push(`expected no bootstrap when the skills directory is missing, got ${result.firstBootstrapParts}`);
  }
  if (result.secondBootstrapParts !== 0) {
    failures.push(`expected no bootstrap on second missing-skills-dir transform, got ${result.secondBootstrapParts}`);
  }
  if (result.firstReadCount !== 0 || result.secondReadCount !== 0) {
    failures.push(`expected missing skills directory to avoid reads, got ${result.secondReadCount}`);
  }
  if (result.secondExistsCount !== result.firstExistsCount) {
    failures.push(`expected missing-skills-dir result to be cached, got ${result.secondExistsCount - result.firstExistsCount} extra exists checks`);
  }

  return failures;
}
