import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
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

type TextBlock = {
  type: "text";
  text: string;
};

type ContentBlock =
  | ToolUseBlock
  | ToolResultBlock
  | TextBlock
  | { type: string };

type UsageRecord = {
  input_tokens?: number;
  output_tokens?: number;
  cache_creation_input_tokens?: number;
  cache_read_input_tokens?: number;
};

type TranscriptRecord = {
  type: "user" | "assistant" | string;
  timestamp?: string;
  message?: {
    id?: string;
    role?: string;
    usage?: UsageRecord;
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

function readRecords(jsonlPath: string): TranscriptRecord[] {
  const raw = readFileSync(jsonlPath, "utf8");
  const records: TranscriptRecord[] = [];
  for (const line of raw.split("\n")) {
    if (line.length === 0) continue;
    try {
      records.push(JSON.parse(line) as TranscriptRecord);
    } catch {
      // skip malformed lines
    }
  }
  return records;
}

function extractInvocations(records: TranscriptRecord[]): ToolInvocation[] {
  const invocations: ToolInvocation[] = [];
  const indexById = new Map<string, number>();

  for (const record of records) {
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

export function parseTranscript(jsonlPath: string): ToolInvocation[] {
  return extractInvocations(readRecords(jsonlPath));
}

export type TranscriptSummary = {
  tool_invocations: ToolInvocation[];
  /**
   * Sum of usage across unique API responses. One response spans multiple
   * jsonl lines (one per content block) and repeats the same `message.id` +
   * `usage` on each, so totals are deduped by `message.id`. Includes cache
   * creation/read tokens — a different accounting than the harness's task
   * completion event.
   */
  total_tokens: number | null;
  /** Wall clock between the first and last line timestamps. */
  duration_ms: number | null;
  /** Concatenated text blocks of the last assistant message. */
  final_text: string | null;
};

export function parseTranscriptFull(jsonlPath: string): TranscriptSummary {
  const records = readRecords(jsonlPath);

  const usageById = new Map<string, UsageRecord>();
  let firstTs: number | null = null;
  let lastTs: number | null = null;
  let timestampCount = 0;
  let finalText: string | null = null;

  for (const record of records) {
    if (record.timestamp) {
      const ts = Date.parse(record.timestamp);
      if (!Number.isNaN(ts)) {
        if (firstTs === null) firstTs = ts;
        lastTs = ts;
        timestampCount++;
      }
    }

    if (record.type !== "assistant") continue;

    const { id, usage } = record.message ?? {};
    if (id && usage) usageById.set(id, usage);

    const texts = flattenContent(record.message?.content)
      .filter((b): b is TextBlock => b.type === "text")
      .map((b) => b.text);
    if (texts.length > 0) finalText = texts.join("\n");
  }

  let totalTokens: number | null = null;
  if (usageById.size > 0) {
    totalTokens = 0;
    for (const usage of usageById.values()) {
      totalTokens +=
        (usage.input_tokens ?? 0) +
        (usage.output_tokens ?? 0) +
        (usage.cache_creation_input_tokens ?? 0) +
        (usage.cache_read_input_tokens ?? 0);
    }
  }

  return {
    tool_invocations: extractInvocations(records),
    total_tokens: totalTokens,
    duration_ms:
      timestampCount >= 2 && firstTs !== null && lastTs !== null
        ? lastTs - firstTs
        : null,
    final_text: finalText,
  };
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

  // Descriptions are namespaced per iteration+run (see run.ts), so duplicates
  // here mean a retry within the same run. Prefer the most-recently-written
  // transcript; readdir order is not chronological.
  matches.sort((a, b) => {
    try {
      return statSync(b.jsonlPath).mtimeMs - statSync(a.jsonlPath).mtimeMs;
    } catch {
      return 0;
    }
  });
  return matches[0];
}
