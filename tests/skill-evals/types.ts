export type AssertionTranscriptCheck = {
	id: string;
	type: "transcript_check";
	check: string;
	pattern?: string;
	must_precede?: "completion_claim" | "any";
};

export type AssertionLLMJudge = {
	id: string;
	type: "llm_judge";
	rubric: string;
	model?: string;
};

export type Assertion = AssertionTranscriptCheck | AssertionLLMJudge;

export type Eval = {
	id: string;
	prompt: string;
	expected_output: string;
	files?: string[];
	assertions?: Assertion[];
};

export type EvalsConfig = {
	skill_name: string;
	evals: Eval[];
};

export type ConditionEntry = {
	name: string;
	skill_path: string | null;
};

export type ConditionsRecord = {
	mode: "new-skill" | "revision";
	baseline?: string;
	conditions: ConditionEntry[];
	timestamp: string;
};

export type ToolInvocation = {
	name: string;
	args?: unknown;
	result?: unknown;
	ordinal: number;
};

export type RunRecord = {
	eval_id: string;
	condition: string;
	skill_path: string | null;
	prompt: string;
	files: string[];
	final_message: string;
	tool_invocations: ToolInvocation[];
	total_tokens: number | null;
	duration_ms: number | null;
};

export type AssertionResult = {
	id: string;
	passed: boolean;
	evidence: string;
	confidence?: number;
	grader?: "transcript_check" | "llm_judge";
};

export type GradingResult = {
	assertion_results: AssertionResult[];
	meta_results?: AssertionResult[];
	summary: {
		passed: number;
		failed: number;
		total: number;
		pass_rate: number;
	};
	meta_summary?: {
		passed: number;
		failed: number;
		total: number;
		skill_invoked: boolean | null;
	};
};

export const SKILL_INVOKED_META_ID = "__skill_invoked";

export type TimingRecord = {
	total_tokens?: number | null;
	duration_ms?: number | null;
};
