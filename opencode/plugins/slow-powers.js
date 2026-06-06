/**
 * Slow-powers plugin for OpenCode.ai
 *
 * Injects slow-powers bootstrap context via system prompt transform.
 * Auto-registers skills directory via config hook (no symlinks needed).
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const slowPowersSkillsDir = path.resolve(__dirname, "../../skills");
const bootstrapPath = path.resolve(__dirname, "../../bootstrap.md");
// First line of bootstrap.md — used as an idempotency check so we don't
// re-inject when OpenCode reruns the transform on an already-transformed
// message array. Specific enough that user prompts won't accidentally match.
const bootstrapLeadingPhrase = "<EXTREMELY-IMPORTANT>";

// Module-level cache for bootstrap content.
// The bootstrap.md file does not change during a session, so reading it
// once eliminates redundant fs work on every agent step.
let _bootstrapCache; // undefined = not yet loaded, null = file missing

export const SlowPowersPlugin = async ({
  client: _client,
  directory: _directory,
}) => {
  // Helper to load bootstrap content (cached after first call)
  const getBootstrapContent = () => {
    if (_bootstrapCache !== undefined) return _bootstrapCache;

    if (!fs.existsSync(bootstrapPath)) {
      _bootstrapCache = null;
      return null;
    }

    _bootstrapCache = fs.readFileSync(bootstrapPath, "utf8");

    return _bootstrapCache;
  };

  return {
    // Inject skills path into live config so OpenCode discovers slow-powers skills
    // without requiring manual symlinks or config file edits.
    // This works because Config.get() returns a cached singleton — modifications
    // here are visible when skills are lazily discovered later.
    config: async (config) => {
      config.skills = config.skills || {};
      config.skills.paths = config.skills.paths || [];
      if (
        fs.existsSync(slowPowersSkillsDir) &&
        !config.skills.paths.includes(slowPowersSkillsDir)
      ) {
        config.skills.paths.push(slowPowersSkillsDir);
      }
    },

    // Inject bootstrap into the first user message of each session.
    // Using a user message instead of a system message avoids:
    //   1. Token bloat from system messages repeated every turn (#750)
    //   2. Multiple system messages breaking Qwen and other models (#894)
    //
    // The hook fires on every agent step (not just every turn) because
    // opencode's prompt.ts reloads messages from DB each step.  Fresh message
    // arrays may need injection again, so getBootstrapContent() must not do
    // repeated disk work.
    "experimental.chat.messages.transform": async (_input, output) => {
      const bootstrap = getBootstrapContent();
      if (!bootstrap || !output.messages.length) return;
      const firstUser = output.messages.find((m) => m.info.role === "user");
      if (!firstUser?.parts.length) return;

      // Guard: skip only when the leading part is the bootstrap we injected.
      // This prevents double injection when OpenCode passes an already
      // transformed in-memory message array through the hook again.
      if (
        firstUser.parts[0]?.type === "text" &&
        firstUser.parts[0].text.startsWith(bootstrapLeadingPhrase)
      )
        return;

      firstUser.parts.unshift({ type: "text", text: bootstrap });
    },
  };
};
