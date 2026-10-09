import type { Plugin, ViteDevServer } from 'vite';
import { spawn, type ChildProcess } from 'node:child_process';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import type { IncomingMessage, ServerResponse } from 'node:http';

interface ActiveSession {
  id: string;
  process: ChildProcess;
  startedAt: string;
}

const activeSessions = new Map<string, ActiveSession>();
const sseClients = new Map<string, ServerResponse[]>();

function getHomeDir(): string {
  return os.homedir();
}

function findClaudeCandidates(): string[] {
  const home = getHomeDir();
  const isWin = process.platform === 'win32';
  const candidates: string[] = [];

  if (isWin) {
    candidates.push(path.join(home, '.local', 'bin', 'claude.exe'));
    candidates.push(path.join(home, '.claude', 'local', 'claude.exe'));
    const localAppData = process.env.LOCALAPPDATA || path.join(home, 'AppData', 'Local');
    candidates.push(path.join(localAppData, 'Programs', 'claude', 'claude.exe'));
    const appData = process.env.APPDATA || path.join(home, 'AppData', 'Roaming');
    candidates.push(path.join(appData, 'npm', 'claude.cmd'));
    candidates.push('claude.exe');
    candidates.push('claude.cmd');
    candidates.push('claude');
  } else {
    candidates.push(path.join(home, '.local', 'bin', 'claude'));
    candidates.push(path.join('/usr', 'local', 'bin', 'claude'));
    candidates.push(path.join('/opt', 'homebrew', 'bin', 'claude'));
    candidates.push(path.join(home, '.npm-global', 'bin', 'claude'));
    candidates.push('claude');
  }

  return candidates;
}

function runVersionCheck(
  executable: string,
  args: string[] = ['--version'],
): Promise<{ version: string | null; code: number }> {
  return new Promise((resolve) => {
    try {
      const child = spawn(executable, args, {
        shell: false,
        windowsHide: true,
      });

      let stdout = '';
      let stderr = '';

      child.stdout?.on('data', (d) => {
        stdout += d.toString();
      });
      child.stderr?.on('data', (d) => {
        stderr += d.toString();
      });

      const timer = setTimeout(() => {
        try {
          child.kill();
        } catch {
          // ignore
        }
        resolve({ version: null, code: -1 });
      }, 5000);

      child.on('error', () => {
        clearTimeout(timer);
        resolve({ version: null, code: -1 });
      });

      child.on('close', (code) => {
        clearTimeout(timer);
        const raw = (stdout || stderr).trim();
        const firstLine = raw.split(/[\r\n]+/)[0]?.trim() || null;
        resolve({ version: firstLine, code: code ?? 0 });
      });
    } catch {
      resolve({ version: null, code: -1 });
    }
  });
}

async function detectExecutable(explicitPath?: string | null) {
  if (explicitPath) {
    if (fs.existsSync(explicitPath)) {
      const { version, code } = await runVersionCheck(explicitPath);
      return {
        found: true,
        path: explicitPath,
        version,
        source: 'configured',
        versionExitCode: code,
        error: null,
        checkedAt: new Date().toISOString(),
      };
    }
    return {
      found: false,
      path: explicitPath,
      version: null,
      source: 'configured',
      versionExitCode: null,
      error: { code: 'not_found', message: `Executable not found at "${explicitPath}"` },
      checkedAt: new Date().toISOString(),
    };
  }

  const envPath = process.env.NANI_CLAUDE_PATH;
  if (envPath && fs.existsSync(envPath)) {
    const { version, code } = await runVersionCheck(envPath);
    return {
      found: true,
      path: envPath,
      version,
      source: 'environment',
      versionExitCode: code,
      error: null,
      checkedAt: new Date().toISOString(),
    };
  }

  const candidates = findClaudeCandidates();
  for (const cand of candidates) {
    if (path.isAbsolute(cand) && fs.existsSync(cand)) {
      const { version, code } = await runVersionCheck(cand);
      if (version !== null || code === 0) {
        return {
          found: true,
          path: cand,
          version,
          source: 'well-known',
          versionExitCode: code,
          error: null,
          checkedAt: new Date().toISOString(),
        };
      }
    } else if (!path.isAbsolute(cand)) {
      const { version, code } = await runVersionCheck(cand);
      if (version !== null && code === 0) {
        return {
          found: true,
          path: cand,
          version,
          source: 'PATH',
          versionExitCode: code,
          error: null,
          checkedAt: new Date().toISOString(),
        };
      }
    }
  }

  return {
    found: false,
    path: null,
    version: null,
    source: 'none',
    versionExitCode: null,
    error: {
      code: 'not_found',
      message: 'Claude Code CLI was not found on PATH or in well-known locations.',
    },
    checkedAt: new Date().toISOString(),
  };
}

function broadcastEvent(sessionId: string, event: Record<string, unknown>) {
  const clients = sseClients.get(sessionId) || [];
  const payload = `data: ${JSON.stringify(event)}\n\n`;
  for (const client of clients) {
    try {
      client.write(payload);
    } catch {
      // ignore broken pipe
    }
  }
}

function parseBody(req: IncomingMessage): Promise<Record<string, unknown>> {
  return new Promise((resolve) => {
    let body = '';
    req.on('data', (chunk) => {
      body += chunk;
    });
    req.on('end', () => {
      try {
        resolve(JSON.parse(body || '{}'));
      } catch {
        resolve({});
      }
    });
  });
}

function sendJson(res: ServerResponse, data: unknown, status = 200) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json');
  res.end(JSON.stringify(data));
}

function pickFolderNative(): Promise<string | null> {
  return new Promise((resolve) => {
    const isWin = process.platform === 'win32';
    const isMac = process.platform === 'darwin';

    if (isWin) {
      const psScript =
        'Add-Type -AssemblyName System.Windows.Forms; ' +
        '$d = New-Object System.Windows.Forms.FolderBrowserDialog; ' +
        '$d.Description = "Select project folder for Claude Code"; ' +
        '$d.ShowNewFolderButton = $true; ' +
        '$f = New-Object System.Windows.Forms.Form; ' +
        '$f.TopMost = $true; ' +
        '$f.StartPosition = "CenterScreen"; ' +
        'if ($d.ShowDialog($f) -eq [System.Windows.Forms.DialogResult]::OK) { ' +
        '[Console]::Out.Write($d.SelectedPath) }';

      const child = spawn(
        'powershell.exe',
        ['-NoProfile', '-NonInteractive', '-STA', '-Command', psScript],
        { windowsHide: false },
      );

      let stdout = '';
      child.stdout?.on('data', (d) => {
        stdout += d.toString();
      });
      child.on('close', () => {
        const trimmed = stdout.trim();
        resolve(trimmed || null);
      });
      child.on('error', () => resolve(null));
    } else if (isMac) {
      const child = spawn('osascript', [
        '-e',
        'POSIX path of (choose folder with prompt "Select project folder for Claude Code")',
      ]);
      let stdout = '';
      child.stdout?.on('data', (d) => {
        stdout += d.toString();
      });
      child.on('close', () => resolve(stdout.trim() || null));
      child.on('error', () => resolve(null));
    } else {
      const child = spawn('zenity', [
        '--file-selection',
        '--directory',
        '--title=Select project folder for Claude Code',
      ]);
      let stdout = '';
      child.stdout?.on('data', (d) => {
        stdout += d.toString();
      });
      child.on('close', (code) => {
        resolve(code === 0 && stdout.trim() ? stdout.trim() : null);
      });
      child.on('error', () => resolve(null));
    }
  });
}

export function naniNativeServicePlugin(): Plugin {
  return {
    name: 'nani-native-service',
    configureServer(server: ViteDevServer) {
      server.middlewares.use(async (req, res, next) => {
        const urlObj = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`);
        const pathname = urlObj.pathname;

        if (!pathname.startsWith('/api/nani')) {
          return next();
        }

        // Allow CORS for local dev
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
        res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

        if (req.method === 'OPTIONS') {
          res.statusCode = 204;
          return res.end();
        }

        try {
          if (pathname === '/api/nani/status') {
            return sendJson(res, { available: true, version: '0.1.0', mode: 'local-node' });
          }

          if (pathname === '/api/nani/detect') {
            const explicit = urlObj.searchParams.get('cli');
            const result = await detectExecutable(explicit);
            return sendJson(res, result);
          }

          if (pathname === '/api/nani/verify-cli') {
            const body = await parseBody(req);
            const command = String(body.command || '');
            const args = Array.isArray(body.args) ? body.args.map(String) : ['--version'];
            if (!command) {
              return sendJson(res, { ok: false, message: 'Missing command' }, 400);
            }

            const check = await runVersionCheck(command, args);
            return sendJson(res, {
              ok: check.version !== null || check.code === 0,
              version: check.version,
              exitCode: check.code,
            });
          }

          if (pathname === '/api/nani/check-auth') {
            const apiKey = process.env.ANTHROPIC_API_KEY;
            return sendJson(res, {
              state: apiKey ? 'ready' : 'ready', // CLI manages its own token store
              method: apiKey ? 'ANTHROPIC_API_KEY' : 'claude-oauth',
              detail: apiKey ? 'Using ANTHROPIC_API_KEY from environment' : 'Local Claude Code CLI credentials',
              raw: null,
              exitCode: 0,
              checkedAt: new Date().toISOString(),
              error: null,
            });
          }

          if (pathname === '/api/nani/validate-project') {
            const projPath = urlObj.searchParams.get('path') || '';
            if (!projPath) {
              return sendJson(res, {
                valid: false,
                path: '',
                reason: 'not_found',
                message: 'No path specified',
                isDirectory: false,
                readable: false,
              });
            }

            try {
              const stat = fs.statSync(projPath);
              return sendJson(res, {
                valid: stat.isDirectory(),
                path: projPath,
                reason: stat.isDirectory() ? null : 'not_a_directory',
                message: stat.isDirectory() ? null : 'Path is not a directory',
                isDirectory: stat.isDirectory(),
                readable: true,
              });
            } catch (err: unknown) {
              const msg = err instanceof Error ? err.message : String(err);
              return sendJson(res, {
                valid: false,
                path: projPath,
                reason: 'not_found',
                message: msg,
                isDirectory: false,
                readable: false,
              });
            }
          }

          if (pathname === '/api/nani/pick-folder') {
            const folder = await pickFolderNative();
            return sendJson(res, { path: folder });
          }

          if (pathname === '/api/nani/common-paths') {
            const home = os.homedir();
            return sendJson(res, {
              home,
              desktop: path.join(home, 'Desktop'),
              downloads: path.join(home, 'Downloads'),
              documents: path.join(home, 'Documents'),
              current: process.cwd(),
            });
          }

          if (pathname === '/api/nani/list-dir') {
            const dir = urlObj.searchParams.get('path') || process.cwd();
            try {
              const entries = fs.readdirSync(dir, { withFileTypes: true });
              const subdirs = entries
                .filter((e) => e.isDirectory() && !e.name.startsWith('.'))
                .map((e) => ({
                  name: e.name,
                  path: path.join(dir, e.name),
                }))
                .slice(0, 50);
              return sendJson(res, { path: dir, subdirs });
            } catch (err: unknown) {
              const msg = err instanceof Error ? err.message : String(err);
              return sendJson(res, { path: dir, error: msg, subdirs: [] }, 400);
            }
          }

          if (pathname === '/api/nani/session-events') {
            const sessionId = urlObj.searchParams.get('sessionId') || 'default';
            res.writeHead(200, {
              'Content-Type': 'text/event-stream',
              'Cache-Control': 'no-cache',
              Connection: 'keep-alive',
            });
            res.write('\n');

            const list = sseClients.get(sessionId) || [];
            list.push(res);
            sseClients.set(sessionId, list);

            req.on('close', () => {
              const cur = sseClients.get(sessionId) || [];
              sseClients.set(
                sessionId,
                cur.filter((c) => c !== res),
              );
            });
            return;
          }

          if (pathname === '/api/nani/start-session' && req.method === 'POST') {
            const body = await parseBody(req);
            const projectPath = String(body.projectPath || '');
            const prompt = String(body.prompt || '');
            const cliPath = body.cliPath ? String(body.cliPath) : null;
            const customArgs = Array.isArray(body.cliArgs) ? body.cliArgs.map(String) : [];

            // Detect CLI executable
            const detection = await detectExecutable(cliPath);
            if (!detection.found || !detection.path) {
              return sendJson(res, { error: 'CLI executable not found' }, 404);
            }

            const sessionId = `sess_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
            const startedAt = new Date().toISOString();

            // Prepare CLI arguments
            const isClaude = detection.path.toLowerCase().includes('claude');
            const procArgs: string[] = [];

            if (isClaude) {
              // Structured Claude Code CLI arguments
              procArgs.push('-p', prompt);
              procArgs.push('--output-format', (body.outputFormat as string) || 'stream-json');
              if (body.model) {
                procArgs.push('--model', String(body.model));
              }
              if (body.permissionMode === 'bypassPermissions') {
                procArgs.push('--dangerously-skip-permissions');
              }
            } else {
              // Any generic CLI
              if (customArgs.length > 0) {
                procArgs.push(...customArgs);
              }
              procArgs.push(prompt);
            }

            let seq = 0;

            const child = spawn(detection.path, procArgs, {
              cwd: fs.existsSync(projectPath) ? projectPath : process.cwd(),
              shell: false,
              windowsHide: true,
            });

            activeSessions.set(sessionId, {
              id: sessionId,
              process: child,
              startedAt,
            });

            setTimeout(() => {
              broadcastEvent(sessionId, {
                sessionId,
                seq: ++seq,
                type: 'session_started',
                pid: child.pid || null,
                at: new Date().toISOString(),
              });
            }, 50);

            child.stdout?.on('data', (chunk) => {
              const text = chunk.toString();
              broadcastEvent(sessionId, {
                sessionId,
                seq: ++seq,
                type: 'stdout_chunk',
                text,
                at: new Date().toISOString(),
              });
            });

            child.stderr?.on('data', (chunk) => {
              const text = chunk.toString();
              broadcastEvent(sessionId, {
                sessionId,
                seq: ++seq,
                type: 'stderr_chunk',
                text,
                at: new Date().toISOString(),
              });
            });

            child.on('close', (code, signal) => {
              broadcastEvent(sessionId, {
                sessionId,
                seq: ++seq,
                type: 'session_exited',
                code,
                signal: signal ? 15 : null,
                at: new Date().toISOString(),
              });
              activeSessions.delete(sessionId);
            });

            child.on('error', (err) => {
              broadcastEvent(sessionId, {
                sessionId,
                seq: ++seq,
                type: 'stderr_chunk',
                text: `Process error: ${err.message}\n`,
                at: new Date().toISOString(),
              });
              broadcastEvent(sessionId, {
                sessionId,
                seq: ++seq,
                type: 'session_exited',
                code: 1,
                signal: null,
                at: new Date().toISOString(),
              });
              activeSessions.delete(sessionId);
            });

            return sendJson(res, {
              sessionId,
              startedAt,
              pid: child.pid || null,
            });
          }

          if (pathname === '/api/nani/stop-session' && req.method === 'POST') {
            const body = await parseBody(req);
            const sessionId = String(body.sessionId || '');
            const active = activeSessions.get(sessionId);
            if (active) {
              try {
                if (process.platform === 'win32' && active.process.pid) {
                  spawn('taskkill', ['/pid', String(active.process.pid), '/f', '/t']);
                } else {
                  active.process.kill('SIGTERM');
                }
              } catch {
                // ignore
              }
            }
            return sendJson(res, { ok: true });
          }

          if (pathname === '/api/nani/skills') {
            const home = getHomeDir();
            const skillsDir = path.join(home, '.claude', 'skills');
            const skills: Array<{ name: string; path: string; scope: string; description: string; fileCount: number }> = [];

            if (fs.existsSync(skillsDir)) {
              const entries = fs.readdirSync(skillsDir, { withFileTypes: true });
              for (const entry of entries) {
                if (entry.isDirectory()) {
                  const sPath = path.join(skillsDir, entry.name);
                  const skillMd = path.join(sPath, 'SKILL.md');
                  let desc = 'Claude Code CLI Skill';
                  if (fs.existsSync(skillMd)) {
                    const content = fs.readFileSync(skillMd, 'utf-8');
                    const firstP = content.split('\n\n').find((p) => !p.startsWith('#') && p.trim().length > 0);
                    if (firstP) desc = firstP.trim().slice(0, 150);
                  }
                  skills.push({
                    name: entry.name,
                    path: sPath,
                    scope: 'user',
                    description: desc,
                    fileCount: 1,
                  });
                }
              }
            }

            return sendJson(res, skills);
          }

          if (pathname === '/api/nani/provider-config') {
            return sendJson(res, {
              scope: 'user',
              targetPath: path.join(getHomeDir(), '.claude', 'config.json'),
              beforeContent: '{\n  "model": "claude-3-7-sonnet-latest"\n}',
              afterContent: '{\n  "model": "claude-3-7-sonnet-latest"\n}',
              diffUnified: '',
              backupPath: null,
              hasChanges: false,
              error: null,
            });
          }

          return next();
        } catch (e: unknown) {
          const err = e instanceof Error ? e.message : String(e);
          return sendJson(res, { error: err }, 500);
        }
      });
    },
  };
}
