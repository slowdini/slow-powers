import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import type { ToolInvocation } from "../types";

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

function parseArgValue(val: unknown): unknown {
	if (typeof val !== "string") {
		if (val && typeof val === "object") {
			if (Array.isArray(val)) {
				return val.map(parseArgValue);
			}
			const cleaned: Record<string, unknown> = {};
			for (const [k, v] of Object.entries(val)) {
				cleaned[k] = parseArgValue(v);
			}
			return cleaned;
		}
		return val;
	}
	try {
		let cleanedStr = val.trim();
		if (cleanedStr.startsWith('"') && cleanedStr.endsWith('"')) {
			cleanedStr = JSON.parse(cleanedStr) as string;
		}
		if (cleanedStr === "true") return true;
		if (cleanedStr === "false") return false;
		if (cleanedStr === "null") return null;
		if (!isNaN(Number(cleanedStr)) && cleanedStr !== "") return Number(cleanedStr);
		
		if (
			(cleanedStr.startsWith("{") && cleanedStr.endsWith("}")) ||
			(cleanedStr.startsWith("[") && cleanedStr.endsWith("]"))
		) {
			try {
				return parseArgValue(JSON.parse(cleanedStr));
			} catch {
				return cleanedStr;
			}
		}
		return cleanedStr;
	} catch {
		return val;
	}
}

export function parseTranscript(jsonlPath: string): ToolInvocation[] {
	const raw = readFileSync(jsonlPath, "utf8");
	const lines = raw.split("\n").filter((l) => l.trim().length > 0);

	const invocations: ToolInvocation[] = [];
	const pendingInvocations: ToolInvocation[] = [];

	for (const line of lines) {
		let record: any;
		try {
			record = JSON.parse(line);
		} catch {
			continue;
		}

		if (record.source === "MODEL") {
			if (record.type === "PLANNER_RESPONSE") {
				const toolCalls = record.tool_calls || [];
				for (const tc of toolCalls) {
					const cleanedArgs = tc.args ? parseArgValue(tc.args) : undefined;
					const ordinal = invocations.length;
					const tu: ToolInvocation = {
						name: tc.name,
						args: cleanedArgs,
						ordinal,
					};
					invocations.push(tu);
					pendingInvocations.push(tu);
				}
			} else {
				const tu = pendingInvocations.shift();
				if (tu) {
					tu.result = record.content;
				}
			}
		}
	}

	return invocations;
}

export function listSubagents(subagentsDir: string): SubagentEntry[] {
	if (!existsSync(subagentsDir)) return [];
	const entries = readdirSync(subagentsDir);
	const subagentMap = new Map<string, string>();

	for (const entry of entries) {
		const dirPath = join(subagentsDir, entry);
		let stat;
		try {
			stat = statSync(dirPath);
		} catch {
			continue;
		}
		if (!stat.isDirectory()) continue;

		const jsonlPath = join(
			dirPath,
			".system_generated",
			"logs",
			"transcript.jsonl",
		);
		if (!existsSync(jsonlPath)) continue;

		try {
			const raw = readFileSync(jsonlPath, "utf8");
			const lines = raw.split("\n").filter((l) => l.trim().length > 0);

			const pendingSubagents: { subagents: any[] }[] = [];

			for (const line of lines) {
				let record: any;
				try {
					record = JSON.parse(line);
				} catch {
					continue;
				}

				if (record.source === "MODEL") {
					if (record.type === "PLANNER_RESPONSE") {
						const toolCalls = record.tool_calls || [];
						for (const tc of toolCalls) {
							if (tc.name === "invoke_subagent") {
								const args = tc.args ? parseArgValue(tc.args) : {};
								const subagents = (args as { Subagents?: any[] }).Subagents || [];
								pendingSubagents.push({ subagents });
							}
						}
					} else {
						const nextPending = pendingSubagents.shift();
						if (nextPending) {
							const content = record.content || "";
							const uuidRegex =
								/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi;
							const uuids = content.match(uuidRegex);
							if (uuids) {
								for (
									let k = 0;
									k < Math.min(nextPending.subagents.length, uuids.length);
									k++
								) {
									const subagent = nextPending.subagents[k];
									const desc =
										subagent.Role ||
										subagent.Prompt ||
										subagent.TypeName ||
										"";
									subagentMap.set(uuids[k].toLowerCase(), desc);
								}
							}
						}
					}
				}
			}
		} catch {}
	}

	const out: SubagentEntry[] = [];
	for (const [uuid, desc] of subagentMap.entries()) {
		const subagentLogsDir = join(
			subagentsDir,
			uuid,
			".system_generated",
			"logs",
		);
		const jsonlPath = join(subagentLogsDir, "transcript.jsonl");
		if (existsSync(jsonlPath)) {
			out.push({
				jsonlPath,
				metaPath: join(subagentsDir, uuid, "meta_mock.json"),
				meta: {
					description: desc,
				},
			});
		}
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
