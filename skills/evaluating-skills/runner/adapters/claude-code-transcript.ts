import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import type { ToolInvocation } from "../types";

type ToolUseBlock = {
  type: "tool_use";
  id: string;
  name: string;
  input: unknown;
};

type ToolResultBlock = {
  type: "tool_result";
  tool_use_id: string;
  content: string | unknown[];
};

type ContentBlock = ToolUseBlock | ToolResultBlock | { type: string };

type TranscriptRecord = {
  type: "user" | "assistant" | string;
  message?: {
    role?: string;
    content?: string | ContentBlock[];
  };
};

function flattenContent(
  content: string | ContentBlock[] | undefined,
): ContentBlock[] {
  if (!content) return [];
  if (typeof content === "string") return [];
  return content;
}

function stringifyResult(content: ToolResultBlock["content"]): string {
  if (typeof content === "string") return content;
  if (Array.isArray(content))
    return content
      .map((c) => {
        if (typeof c === "string") return c;
        if (c && typeof c === "object" && "text" in c)
          return String((c as { text: unknown }).text);
        return JSON.stringify(c);
      })
      .join("\n");
  return JSON.stringify(content);
}

export function parseTranscript(jsonlPath: string): ToolInvocation[] {
  const raw = readFileSync(jsonlPath, "utf8");
  const lines = raw.split("\n").filter((l) => l.length > 0);

  const invocations: ToolInvocation[] = [];
  const indexById = new Map<string, number>();

  for (const line of lines) {
    let record: TranscriptRecord;
    try {
      record = JSON.parse(line) as TranscriptRecord;
    } catch {
      continue;
    }

    const blocks = flattenContent(record.message?.content);

    if (record.type === "assistant") {
      for (const block of blocks) {
        if (block.type !== "tool_use") continue;
        const tu = block as ToolUseBlock;
        const ordinal = invocations.length;
        indexById.set(tu.id, ordinal);
        invocations.push({
          name: tu.name,
          args: tu.input,
          ordinal,
        });
      }
      continue;
    }

    if (record.type === "user") {
      for (const block of blocks) {
        if (block.type !== "tool_result") continue;
        const tr = block as ToolResultBlock;
        const idx = indexById.get(tr.tool_use_id);
        if (idx === undefined) continue;
        invocations[idx].result = stringifyResult(tr.content);
      }
    }
  }

  return invocations;
}

export type SubagentMeta = {
  agentType?: string;
  description?: string;
  toolUseId?: string;
};

export type SubagentEntry = {
  jsonlPath: string;
  metaPath: string;
  meta: SubagentMeta;
};

export function listSubagents(subagentsDir: string): SubagentEntry[] {
  if (!existsSync(subagentsDir)) return [];
  const files = readdirSync(subagentsDir);
  const out: SubagentEntry[] = [];
  for (const f of files) {
    if (!f.endsWith(".meta.json")) continue;
    const base = f.slice(0, -".meta.json".length);
    const metaPath = join(subagentsDir, f);
    const jsonlPath = join(subagentsDir, `${base}.jsonl`);
    if (!existsSync(jsonlPath)) continue;
    try {
      const meta = JSON.parse(readFileSync(metaPath, "utf8")) as SubagentMeta;
      out.push({ jsonlPath, metaPath, meta });
    } catch {}
  }
  return out;
}

export function findByDescription(
  subagentsDir: string,
  description: string,
): SubagentEntry | null {
  const entries = listSubagents(subagentsDir);
  const matches = entries.filter((e) => e.meta.description === description);
  if (matches.length === 0) return null;
  if (matches.length === 1) return matches[0];
  return matches[matches.length - 1];
}
