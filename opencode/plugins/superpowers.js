/**
 * Superpowers plugin for OpenCode.ai
 *
 * Injects superpowers bootstrap context via system prompt transform.
 * Auto-registers skills directory via config hook (no symlinks needed).
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const superpowersSkillsDir = path.resolve(__dirname, "../../skills");
const bootstrapPath = path.resolve(__dirname, "../../bootstrap.md");
const bootstrapMarker = "SUPERSLOW_OPENCODE_BOOTSTRAP";

// Module-level cache for bootstrap content.
// The bootstrap.md file does not change during a session, so reading it
// once eliminates redundant fs work on every agent step.
let _bootstrapCache; // undefined = not yet loaded, null = file missing

export const SuperpowersPlugin = async ({
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

    const content = fs.readFileSync(bootstrapPath, "utf8");
    _bootstrapCache = `<!-- ${bootstrapMarker} -->\n${content}`;

    return _bootstrapCache;
  };

  return {
    // Inject skills path into live config so OpenCode discovers superpowers skills
    // without requiring manual symlinks or config file edits.
    // This works because Config.get() returns a cached singleton — modifications
    // here are visible when skills are lazily discovered later.
    config: async (config) => {
      config.skills = config.skills || {};
      config.skills.paths = config.skills.paths || [];
      if (
        fs.existsSync(superpowersSkillsDir) &&
        !config.skills.paths.includes(superpowersSkillsDir)
      ) {
        config.skills.paths.push(superpowersSkillsDir);
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
        firstUser.parts[0].text.includes(bootstrapMarker)
      )
        return;

      firstUser.parts.unshift({ type: "text", text: bootstrap });
    },
  };
};
