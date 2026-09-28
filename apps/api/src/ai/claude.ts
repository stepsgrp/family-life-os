import Anthropic from "@anthropic-ai/sdk";
import { prisma } from "@flos/db";
import type { z } from "zod";
import { env } from "../env";

export const anthropic = new Anthropic({ apiKey: env.ANTHROPIC_API_KEY || undefined });
export const CLAUDE_MODEL = "claude-opus-5";

/** A tool Claude can call, with its input validated by Zod before it runs. */
export interface AgentTool {
  definition: Anthropic.Beta.BetaTool;
  input: z.ZodType<unknown>;
  run: (input: never) => Promise<unknown>;
}

export function defineTool<S extends z.ZodType<unknown>>(
  definition: Omit<Anthropic.Beta.BetaTool, "eager_input_streaming">,
  input: S,
  run: (input: z.infer<S>) => Promise<unknown>,
): AgentTool {
  // eager_input_streaming streams tool inputs as they're generated; we validate every
  // input with Zod below, which the SDK docs require when this flag is on.
  return { definition: { ...definition, eager_input_streaming: true }, input, run: run as AgentTool["run"] };
}

export type AgentEvent =
  | { type: "tool"; name: string; label: string }
  | { type: "text"; delta: string };

interface RunOptions<T> {
  familyId: string;
  feature: "dinner" | "weekend" | "appointment";
  /** Stable across requests so the tools + system prefix is prompt-cached. */
  system: string;
  tools: AgentTool[];
  /** Per-request, family-specific context goes here (after the cached prefix). */
  prompt: string;
  /** JSON Schema for the final answer (structured outputs). */
  outputSchema: Record<string, unknown>;
  parse: z.ZodType<T>;
  effort?: "low" | "medium" | "high";
  toolLabels?: Record<string, string>;
  onEvent?: (event: AgentEvent) => void;
  signal?: AbortSignal;
}

const MAX_TURNS = 8;

/**
 * Manual tool-use loop: Claude calls our tools (all family-scoped server-side), then
 * returns a final answer constrained to `outputSchema`. Streams so long answers don't
 * hit HTTP timeouts and so the weekend planner can forward progress live.
 */
export async function runStructuredAgent<T>(opts: RunOptions<T>): Promise<T> {
  const toolsByName = new Map(opts.tools.map((t) => [t.definition.name, t]));
  const messages: Anthropic.Beta.BetaMessageParam[] = [{ role: "user", content: opts.prompt }];
  const usage = { input: 0, output: 0, cacheRead: 0 };
  let jsonRetries = 0;

  try {
    for (let turn = 0; turn < MAX_TURNS; turn++) {
      const stream = anthropic.beta.messages.stream(
        {
          model: CLAUDE_MODEL,
          max_tokens: 16000,
          // If a safety classifier declines, the API retries on a fallback model in the same call.
          betas: ["server-side-fallback-2026-07-01"],
          fallbacks: "default",
          // Auto prompt caching: tools + system are identical across families.
          cache_control: { type: "ephemeral" },
          system: opts.system,
          tools: opts.tools.map((t) => t.definition),
          output_config: {
            effort: opts.effort ?? "medium",
            format: { type: "json_schema", schema: opts.outputSchema },
          },
          messages,
        },
        { signal: opts.signal },
      );
      if (opts.onEvent) stream.on("text", (delta) => opts.onEvent!({ type: "text", delta }));

      let message: Anthropic.Beta.BetaMessage;
      try {
        message = await stream.finalMessage();
        jsonRetries = 0;
      } catch (err) {
        // Only an unparseable streamed tool input is retried; API errors propagate.
        if (err instanceof Anthropic.APIError || jsonRetries++ >= 2) throw err;
        continue;
      }

      usage.input += message.usage.input_tokens;
      usage.output += message.usage.output_tokens;
      usage.cacheRead += message.usage.cache_read_input_tokens ?? 0;

      if (message.stop_reason === "refusal") throw new AiRefusalError();
      if (message.stop_reason === "max_tokens") throw new Error("AI response was truncated");

      const toolUses = message.content.filter(
        (b): b is Anthropic.Beta.BetaToolUseBlock => b.type === "tool_use",
      );

      if (message.stop_reason !== "tool_use" || toolUses.length === 0) {
        const text = message.content
          .filter((b): b is Anthropic.Beta.BetaTextBlock => b.type === "text")
          .map((b) => b.text)
          .join("");
        return opts.parse.parse(JSON.parse(text));
      }

      messages.push({ role: "assistant", content: message.content });

      // Run tool calls in parallel and return ALL results in a single user message.
      const results = await Promise.all(
        toolUses.map(async (call): Promise<Anthropic.Beta.BetaToolResultBlockParam> => {
          const tool = toolsByName.get(call.name);
          const parsed = tool?.input.safeParse(call.input);
          if (!tool || !parsed?.success) {
            return {
              type: "tool_result",
              tool_use_id: call.id,
              is_error: true,
              content: tool ? `Invalid input: ${parsed?.error?.message}` : `Unknown tool ${call.name}`,
            };
          }
          opts.onEvent?.({ type: "tool", name: call.name, label: opts.toolLabels?.[call.name] ?? call.name });
          try {
            const output = await tool.run(parsed.data as never);
            return { type: "tool_result", tool_use_id: call.id, content: JSON.stringify(output) };
          } catch (err) {
            return {
              type: "tool_result",
              tool_use_id: call.id,
              is_error: true,
              content: err instanceof Error ? err.message : "Tool failed",
            };
          }
        }),
      );
      messages.push({ role: "user", content: results });
    }
    throw new Error("AI agent exceeded the maximum number of steps");
  } finally {
    await prisma.aiUsage.create({
      data: {
        familyId: opts.familyId,
        feature: opts.feature,
        inputTokens: usage.input,
        outputTokens: usage.output,
        cacheReadTokens: usage.cacheRead,
      },
    });
  }
}

export class AiRefusalError extends Error {
  constructor() {
    super("The AI declined this request");
  }
}

/** Helper: JSON Schema object with the strictness structured outputs expects. */
export function objectSchema(properties: Record<string, unknown>, required = Object.keys(properties)) {
  return { type: "object", properties, required, additionalProperties: false };
}
