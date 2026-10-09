import { create } from 'zustand';
import type { NaniBridge } from '../lib/bridge';
import {
  UNKNOWN_USAGE,
  extractUsage,
  extractTextContent,
  parseStreamJsonLine,
} from '../lib/claudeStream';
import type {
  AuthStatus,
  DetectionResult,
  ProjectValidation,
  ProviderConfigPreview,
  SessionEvent,
  SessionState,
  SkillSummary,
  StartSessionResult,
  UsageInfo,
} from '../lib/types';

/** Maximum output lines retained in memory before the oldest are dropped. */
export const MAX_OUTPUT_LINES = 5000;

export interface OutputEntry {
  id: number;
  stream: 'stdout' | 'stderr' | 'diagnostic';
  text: string;
  at: string;
}

export interface ActivityEntry {
  id: number;
  /** Documented stream-json message type. */
  kind: string;
  /** Short honest summary derived from documented fields only. */
  summary: string;
  at: string;
}

export interface AppState {
  bridge: NaniBridge | null;
  ready: boolean;

  /* onboarding / diagnostics */
  detection: DetectionResult | null;
  detecting: boolean;
  detectionError: string | null;
  auth: AuthStatus | null;
  checkingAuth: boolean;

  /* project */
  projectPath: string | null;
  projectValidation: ProjectValidation | null;
  validating: boolean;

  /* prompt / session */
  draftPrompt: string;
  sessionId: string | null;
  sessionState: SessionState;
  startError: string | null;
  output: OutputEntry[];
  activity: ActivityEntry[];
  usage: UsageInfo;
  exitInfo: { code: number | null; signal: number | null; ok: boolean } | null;

  /* provider */
  providerPreview: ProviderConfigPreview | null;

  /* skills */
  skills: SkillSummary[];

  /* ui */
  theme: 'dark' | 'light' | 'system';
  autoScroll: boolean;

  /* actions */
  init: (bridge: NaniBridge) => Promise<void>;
  runDetection: () => Promise<void>;
  runAuthCheck: () => Promise<void>;
  setProjectPath: (path: string | null) => void;
  pickProject: () => Promise<void>;
  validateProject: (path?: string) => Promise<void>;
  setDraftPrompt: (text: string) => void;
  startSession: () => Promise<void>;
  stopSession: () => Promise<void>;
  clearOutput: () => void;
  setAutoScroll: (value: boolean) => void;
  loadSkills: () => Promise<void>;
  removeSkill: (path: string) => Promise<void>;
  setTheme: (theme: 'dark' | 'light' | 'system') => void;
}

let entryId = 0;
let activityId = 0;

function nextId(): number {
  return ++entryId;
}

export const useAppStore = create<AppState>((set, get) => ({
  bridge: null,
  ready: false,

  detection: null,
  detecting: false,
  detectionError: null,
  auth: null,
  checkingAuth: false,

  projectPath: null,
  projectValidation: null,
  validating: false,

  draftPrompt: '',
  sessionId: null,
  sessionState: 'Idle',
  startError: null,
  output: [],
  activity: [],
  usage: UNKNOWN_USAGE,
  exitInfo: null,

  providerPreview: null,
  skills: [],
  theme: 'dark',
  autoScroll: true,

  async init(bridge) {
    set({ bridge, ready: true });
    await bridge.onSessionEvent((event) => applyEvent(set, get, event));
  },

  async runDetection() {
    const { bridge } = get();
    if (!bridge) return;
    set({ detecting: true, detectionError: null });
    try {
      const detection = await bridge.detectClaudeCode();
      set({ detection, detecting: false });
    } catch (error) {
      set({
        detecting: false,
        detection: null,
        detectionError: error instanceof Error ? error.message : String(error),
      });
    }
  },

  async runAuthCheck() {
    const { bridge } = get();
    if (!bridge) return;
    set({ checkingAuth: true });
    try {
      const auth = await bridge.checkAuth();
      set({ auth, checkingAuth: false });
    } catch (error) {
      set({
        checkingAuth: false,
        auth: {
          state: 'unknown',
          method: null,
          detail: null,
          raw: null,
          exitCode: null,
          checkedAt: new Date().toISOString(),
          error: {
            code: 'check_failed',
            message: error instanceof Error ? error.message : String(error),
          },
        },
      });
    }
  },

  setProjectPath(path) {
    set({ projectPath: path, projectValidation: null });
  },

  async pickProject() {
    const { bridge } = get();
    if (!bridge) return;
    const path = await bridge.pickProjectDirectory();
    if (path === null) return;
    get().setProjectPath(path);
    await get().validateProject(path);
  },

  async validateProject(path) {
    const { bridge } = get();
    const target = path ?? get().projectPath;
    if (!bridge || !target) return;
    set({ validating: true });
    try {
      const validation = await bridge.validateProject(target);
      set({ projectValidation: validation, validating: false });
    } catch (error) {
      set({
        validating: false,
        projectValidation: {
          valid: false,
          path: target,
          reason: 'unknown',
          message: error instanceof Error ? error.message : String(error),
          isDirectory: false,
          readable: false,
        },
      });
    }
  },

  setDraftPrompt(text) {
    set({ draftPrompt: text });
  },

  async startSession() {
    const { bridge, projectPath, draftPrompt, sessionState } = get();
    if (!bridge || !projectPath) return;
    if (sessionState === 'Starting' || sessionState === 'Running' || sessionState === 'Stopping') {
      return; // guard against duplicate launches
    }
    set({ sessionState: 'Starting', startError: null, exitInfo: null, usage: UNKNOWN_USAGE });

    const validation = get().projectValidation ?? (await (async () => {
      await get().validateProject(projectPath);
      return get().projectValidation;
    })());
    if (!validation || !validation.valid) {
      set({
        sessionState: 'Failed',
        startError: validation?.message ?? 'Project path is not valid',
      });
      return;
    }

    try {
      const result: StartSessionResult = await bridge.startSession({
        projectPath,
        prompt: draftPrompt,
        outputFormat: 'stream-json',
      });
      set({ sessionId: result.sessionId });
    } catch (error) {
      set({
        sessionState: 'Failed',
        startError: error instanceof Error ? error.message : String(error),
      });
    }
  },

  async stopSession() {
    const { bridge, sessionId, sessionState } = get();
    if (!bridge || !sessionId) return;
    if (sessionState === 'Stopping' || sessionState === 'Completed' || sessionState === 'Failed') {
      return;
    }
    set({ sessionState: 'Stopping' });
    await bridge.stopSession(sessionId);
  },

  clearOutput() {
    set({ output: [], activity: [] });
  },

  setAutoScroll(value) {
    set({ autoScroll: value });
  },

  async loadSkills() {
    const { bridge, projectPath } = get();
    if (!bridge) return;
    const skills = await bridge.listSkills(projectPath);
    set({ skills });
  },

  async removeSkill(path) {
    const { bridge } = get();
    if (!bridge) return;
    await bridge.removeSkill(path);
    await get().loadSkills();
  },

  setTheme(theme) {
    set({ theme });
    applyTheme(theme);
  },
}));

function appendOutput(entries: OutputEntry[], entry: OutputEntry): OutputEntry[] {
  const next = entries.length >= MAX_OUTPUT_LINES ? entries.slice(entries.length - MAX_OUTPUT_LINES + 1) : entries;
  return [...next, entry];
}

type SetState = (partial: Partial<AppState> | ((state: AppState) => Partial<AppState>)) => void;

function applyEvent(set: SetState, _get: () => AppState, event: SessionEvent): void {
  switch (event.type) {
    case 'session_started':
      set({ sessionState: 'Running' });
      return;

    case 'stdout_chunk':
      set((state) => ({
        output: appendOutput(state.output, {
          id: nextId(),
          stream: 'stdout',
          text: event.text,
          at: event.at,
        }),
      }));
      return;

    case 'stderr_chunk':
      set((state) => ({
        output: appendOutput(state.output, {
          id: nextId(),
          stream: 'stderr',
          text: event.text,
          at: event.at,
        }),
      }));
      return;

    case 'structured_cli_event': {
      const parsed = parseStreamJsonLine(JSON.stringify(event.event));
      if (!parsed) return;
      const summary = summariseStructured(parsed.raw);
      set((state) => ({
        activity: [
          ...state.activity.slice(-199),
          { id: ++activityId, kind: parsed.type, summary, at: event.at },
        ],
        usage: extractUsage(parsed) ?? state.usage,
      }));
      return;
    }

    case 'session_stopping':
      set({ sessionState: 'Stopping' });
      return;

    case 'session_exited':
      set({
        sessionState: event.ok ? 'Completed' : 'Failed',
        exitInfo: { code: event.code, signal: event.signal, ok: event.ok },
      });
      return;

    case 'diagnostic':
      set((state) => ({
        output: appendOutput(state.output, {
          id: nextId(),
          stream: 'diagnostic',
          text: `[nani:${event.level}] ${event.message}`,
          at: event.at,
        }),
      }));
      return;
  }
}

/** Produce a short, honest one-line summary using documented fields only. */
function summariseStructured(raw: Record<string, unknown>): string {
  const type = typeof raw['type'] === 'string' ? (raw['type'] as string) : 'event';
  if (type === 'system') {
    const subtype = raw['subtype'];
    return `system${typeof subtype === 'string' ? `/${subtype}` : ''}`;
  }
  if (type === 'result') {
    const subtype = typeof raw['subtype'] === 'string' ? (raw['subtype'] as string) : 'result';
    return `result/${subtype}`;
  }
  const text = extractTextContent({ type: type as never, sessionId: null, raw }).trim();
  if (text) return text.length > 120 ? `${text.slice(0, 117)}…` : text;
  return type;
}

export function applyTheme(theme: 'dark' | 'light' | 'system'): void {
  if (typeof document === 'undefined') return;
  const prefersDark =
    typeof window !== 'undefined' && window.matchMedia
      ? window.matchMedia('(prefers-color-scheme: dark)').matches
      : true;
  const effective = theme === 'system' ? (prefersDark ? 'dark' : 'light') : theme;
  document.documentElement.classList.toggle('dark', effective === 'dark');
  document.documentElement.dataset['theme'] = effective;
}
