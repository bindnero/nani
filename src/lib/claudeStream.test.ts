import { describe, expect, it } from 'vitest';
import {
  extractTextContent,
  extractUsage,
  parseStreamJsonLine,
} from './claudeStream';

describe('parseStreamJsonLine', () => {
  it('parses a documented system init message', () => {
    const parsed = parseStreamJsonLine(
      '{"type":"system","subtype":"init","session_id":"s1","model":"claude"}',
    );
    expect(parsed?.type).toBe('system');
    expect(parsed?.sessionId).toBe('s1');
  });

  it('returns null for non-JSON lines (they stay raw text)', () => {
    expect(parseStreamJsonLine('just some output')).toBeNull();
  });

  it('returns null for blank lines', () => {
    expect(parseStreamJsonLine('   ')).toBeNull();
  });

  it('returns null for unknown message types', () => {
    expect(parseStreamJsonLine('{"type":"mystery"}')).toBeNull();
  });

  it('returns null for JSON arrays and primitives', () => {
    expect(parseStreamJsonLine('[1,2,3]')).toBeNull();
    expect(parseStreamJsonLine('42')).toBeNull();
  });
});

describe('extractUsage', () => {
  it('reads documented result fields and marks them estimated', () => {
    const parsed = parseStreamJsonLine(
      JSON.stringify({
        type: 'result',
        subtype: 'success',
        session_id: 's1',
        duration_ms: 1234,
        num_turns: 2,
        total_cost_usd: 0.0042,
        usage: { input_tokens: 1200, output_tokens: 340, cache_read_input_tokens: 50 },
      }),
    )!;
    const usage = extractUsage(parsed);
    expect(usage).not.toBeNull();
    expect(usage?.provided).toBe(true);
    expect(usage?.estimated).toBe(true);
    expect(usage?.costUsd).toBeCloseTo(0.0042);
    expect(usage?.inputTokens).toBe(1200);
    expect(usage?.outputTokens).toBe(340);
    expect(usage?.cacheReadTokens).toBe(50);
    expect(usage?.numTurns).toBe(2);
  });

  it('prefers modelUsage for accounting when present', () => {
    const parsed = parseStreamJsonLine(
      JSON.stringify({
        type: 'result',
        subtype: 'success',
        usage: { input_tokens: 1, output_tokens: 2 },
        modelUsage: { inputTokens: 10, outputTokens: 20 },
      }),
    )!;
    const usage = extractUsage(parsed);
    expect(usage?.inputTokens).toBe(10);
    expect(usage?.outputTokens).toBe(20);
  });

  it('returns null for non-result messages', () => {
    const parsed = parseStreamJsonLine('{"type":"assistant","session_id":"s1"}')!;
    expect(extractUsage(parsed)).toBeNull();
  });
});

describe('extractTextContent', () => {
  it('joins text blocks from an assistant message', () => {
    const parsed = parseStreamJsonLine(
      JSON.stringify({
        type: 'assistant',
        session_id: 's1',
        message: { content: [{ type: 'text', text: 'Hello ' }, { type: 'text', text: 'world' }] },
      }),
    )!;
    expect(extractTextContent(parsed)).toBe('Hello world');
  });
});
