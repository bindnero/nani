import type { UsageInfo } from './types';

/**
 * Parsing helpers for `claude --print --output-format stream-json`.
 *
 * Every function here only reads fields that are documented as part of the
 * Claude Code stream-json / Agent SDK message schema. Nothing is inferred from
 * plain text, and unknown shapes are returned as-is rather than guessed at.
 *
 * Documented message `type`s: system, assistant, user, result, stream_event.
 * (Source: Agent SDK TypeScript reference, Claude Code headless docs.)
 */

export type ClaudeMessageType = 'system' | 'assistant' | 'user' | 'result' | 'stream_event';

export interface ParsedClaudeMessage {
  type: ClaudeMessageType;
  sessionId: string | null;
  raw: Record<string, unknown>;
}

const KNOWN_TYPES: ReadonlySet<string> = new Set([
  'system',
  'assistant',
  'user',
  'result',
  'stream_event',
]);

/**
 * Parse a single line of stream-json output. Returns null for blank lines,
 * non-JSON lines (which are surfaced as raw stderr/stdout instead), or JSON
 * without a recognised discriminator.
 */
export function parseStreamJsonLine(line: string): ParsedClaudeMessage | null {
  const trimmed = line.trim();
  if (trimmed === '') return null;
  let value: unknown;
  try {
    value = JSON.parse(trimmed);
  } catch {
    return null;
  }
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return null;
  const obj = value as Record<string, unknown>;
  const type = obj['type'];
  if (typeof type !== 'string' || !KNOWN_TYPES.has(type)) return null;
  const sessionId = typeof obj['session_id'] === 'string' ? (obj['session_id'] as string) : null;
  return { type: type as ClaudeMessageType, sessionId, raw: obj };
}

/**
 * The documented `result` message is the only trustworthy source of token and
 * cost data. Cost is documented as a client-side estimate, never a bill.
 */
export function extractUsage(message: ParsedClaudeMessage): UsageInfo | null {
  if (message.type !== 'result') return null;
  const raw = message.raw;
  const usage = asRecord(raw['usage']);
  const modelUsage = asRecord(raw['modelUsage']);

  // Prefer modelUsage for accounting when present (docs recommend it).
  const inputTokens =
    firstNumber(modelUsage?.['inputTokens'], usage?.['input_tokens']) ?? null;
  const outputTokens =
    firstNumber(modelUsage?.['outputTokens'], usage?.['output_tokens']) ?? null;
  const cacheRead =
    firstNumber(modelUsage?.['cacheReadInputTokens'], usage?.['cache_read_input_tokens']) ?? null;
  const cacheCreate =
    firstNumber(
      modelUsage?.['cacheCreationInputTokens'],
      usage?.['cache_creation_input_tokens'],
    ) ?? null;
  const costUsd = firstNumber(raw['total_cost_usd']) ?? null;

  return {
    provided: true,
    estimated: true,
    costUsd,
    inputTokens,
    outputTokens,
    cacheReadTokens: cacheRead,
    cacheCreationTokens: cacheCreate,
    durationMs: firstNumber(raw['duration_ms']) ?? null,
    numTurns: firstNumber(raw['num_turns']) ?? null,
    source: 'stream-json result event',
  };
}

/** A neutral, honestly-labelled placeholder used before any usage is known. */
export const UNKNOWN_USAGE: UsageInfo = {
  provided: false,
  estimated: true,
  costUsd: null,
  inputTokens: null,
  outputTokens: null,
  cacheReadTokens: null,
  cacheCreationTokens: null,
  durationMs: null,
  numTurns: null,
  source: null,
};

/** Render an assistant/user message's text content for display (never as HTML). */
export function extractTextContent(message: ParsedClaudeMessage): string {
  const raw = message.raw;
  const inner = asRecord(raw['message']) ?? raw;
  const content = inner['content'];
  if (typeof content === 'string') return content;
  if (!Array.isArray(content)) return '';
  const parts: string[] = [];
  for (const block of content) {
    const b = asRecord(block);
    if (!b) continue;
    if (b['type'] === 'text' && typeof b['text'] === 'string') parts.push(b['text'] as string);
  }
  return parts.join('');
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function firstNumber(...values: unknown[]): number | null {
  for (const v of values) {
    if (typeof v === 'number' && Number.isFinite(v)) return v;
  }
  return null;
}
