# System Architecture

## 1. Architectural principles
- Local-first; no required Nani backend.
- Tauri provides the desktop shell and controlled access to native capabilities.
- React owns presentation and user interaction; Rust/native services own sensitive OS/process operations.
- Every state shown to the user must derive from a real event or explicitly be labeled as an estimate/unknown.
- Keep integrations replaceable and independently testable.

## 2. Proposed stack
- Desktop: Tauri 2 + Rust.
- Frontend: React + TypeScript + Vite.
- Styling: Tailwind CSS or equivalent utility-based styling, with accessible component primitives.
- Tests: Rust unit tests, Vitest/component tests, and integration tests with a fake CLI executable; optional Playwright/E2E tests.
- License: MIT, with third-party dependency license review.

Confirm currently supported versions and platform prerequisites before installing dependencies. Do not claim this stack is configured until it exists in the repository.

## 3. Logical components
### Frontend
- AppShell / Navigation
- Onboarding and Diagnostics
- Workspace / ProjectPicker
- PromptComposer
- SessionOutput
- ActivityPanel
- TerminalAndLogs
- ProviderSettings
- SkillsManager
- Preferences

### Native/service layer
- `ClaudeCodeDetector`: executable discovery and version check.
- `ClaudeCodeProcess`: safe launch, stream reading, cancellation, exit handling.
- `SessionManager`: lifecycle state and session metadata.
- `ProjectDirectoryService`: native directory picker and path validation.
- `ProviderConfigService`: config read, diff, backup, consented write, validation.
- `SkillsRepository`: supported skill discovery, import, metadata validation, safe removal.
- `SecretStore`: OS credential storage adapter where feasible.
- `DiagnosticsService`: redacted logs and user-controlled export.

## 4. Process bridge
- Launch executable with a structured argument vector and explicit working directory.
- Never form a shell command by concatenating prompt text or paths.
- Use only CLI flags/output modes confirmed by current official Claude Code documentation.
- If a pseudo-terminal is necessary for a workflow, isolate it in a dedicated adapter and test it on every claimed platform.
- Keep stdout and stderr distinguishable.
- Stream typed events to React through Tauri's event mechanism.
- Handle process spawn errors, unexpected exits, cancellation, app shutdown, and output backpressure.

## 5. Session state model
`Idle → Starting → Running → Stopping → Completed | Failed`

Include explicit errors for missing executable, invalid project path, permission denial, authentication/configuration failure, timeout, and abnormal exit. State changes must come from actual process lifecycle events, not timers or animations.

## 6. Suggested event contract
- `session_started`: process successfully spawned, with session ID and timestamp.
- `stdout_chunk`: actual stdout text.
- `stderr_chunk`: actual stderr text.
- `structured_cli_event`: parsed only from documented structured output.
- `session_stopping`: stop requested.
- `session_exited`: actual exit code or signal.
- `diagnostic`: Nani-generated diagnostic, explicitly labeled as such.

Do not convert ordinary text into a fake tool-call event. Do not assume a file was changed just because output mentions a file.

## 7. Data and configuration
- Store non-secret preferences in versioned app data.
- Store secrets in OS credential storage when feasible.
- Keep session history local and user-deletable.
- Configuration updates require a preview, backup, confirmation, and verification.
- Do not upload prompts, source files, logs, or credentials to Nani-controlled services.

## 8. Omni-Company integration boundary
Create an interface such as `ExternalProviderAdapter`, but do not implement an assumed API. After the user supplies the official URL or GitHub repository, inspect its README, license, docs, API shape, authentication, maintenance state, and security implications. Then produce a compatibility decision before coding the integration.

## 9. Security boundaries
- Treat CLI output, project names, paths, and imported skills as untrusted.
- Escape rendered output.
- Validate archive paths and reject traversal/symlink escapes.
- Never auto-run imported skill scripts.
- Redact credentials from logs and diagnostics.
- Avoid admin/root privileges by default.
