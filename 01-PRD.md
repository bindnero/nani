# Product Requirements Document (PRD)

## 1. Product summary
Nani is a cross-platform desktop UI that lets developers use the locally installed Claude Code CLI through a modern graphical workspace. It provides project selection, prompt entry, streamed output, session controls, diagnostics, and configuration guidance while keeping the actual coding agent and execution local to the user's machine.

## 2. Goals
- Make common Claude Code workflows accessible through a desktop GUI.
- Show real CLI output and trustworthy process status.
- Make installation and provider configuration understandable.
- Provide clear errors and recoverable setup flows.
- Keep the application local-first and transparent about data handling.
- Support Windows, macOS, and Linux through Tauri + React.

## 3. Non-goals for the first release
- Reimplementing Claude Code or creating a separate AI agent.
- Using OpenCode as Nani's runtime agent.
- A mandatory cloud account or Nani-hosted backend.
- MCP support unless added in a later approved version.
- Invented token/cost dashboards or synthetic tool-activity feeds.
- Unverified Omni-Company integration before the user supplies its official link/repository.
- Automatic GitHub publication or releases.

## 4. Users and primary scenarios
1. A developer opens Nani and checks whether Claude Code is installed.
2. If it is missing, Nani provides official installation guidance and a re-check button.
3. The developer chooses a project folder and enters a prompt.
4. Nani launches Claude Code using a documented CLI interface and streams output.
5. The developer can stop a session and see the real exit status or error.
6. The developer configures a supported provider route through a guided, reversible flow.
7. The developer reviews and manages reusable skills safely.

## 5. Functional requirements
### 5.1 Onboarding and diagnostics
- Detect the Claude Code executable using platform-appropriate discovery.
- Display actual detected path/version where available.
- Handle missing executable, permissions, invalid path, PATH differences, and failed version checks.
- Provide installation guidance linking to official documentation, plus “Check again”.
- Distinguish “CLI detected” from “authenticated/provider ready”; these are not equivalent.

### 5.2 Project workspace
- Select a directory using a native folder picker.
- Display the selected working directory clearly.
- Validate the directory before launch.
- Support changing projects without losing unsent prompt text where practical.
- Do not scan or upload project contents without user action.

### 5.3 Prompt and session controls
- Multiline prompt composer.
- Send/start action with disabled/loading states.
- Stop/cancel action for active sessions.
- Show state transitions: Idle, Starting, Running, Stopping, Completed, Failed.
- Prevent accidental duplicate launches unless explicitly supported.
- Preserve session output according to a documented local retention policy.

### 5.4 Output and activity
- Stream stdout and stderr separately, or clearly label them if combined for presentation.
- Preserve line breaks and Unicode.
- Display structured tool/activity events only if exposed by a documented, reliable CLI interface.
- Display token usage/cost only when supplied by a trustworthy source; otherwise show “Not provided”.
- Bound memory use for long-running sessions and provide a clear-log action.
- Render CLI output as untrusted text, never as executable UI markup.

### 5.5 Provider configuration
- Provide a Settings section for documented Claude Code provider configuration.
- Omni-Company is a future integration placeholder pending the user's official URL/repository and requirements.
- Any provider option must be verified against current official documentation before being labeled supported.
- Only one active route should be selected at a time unless a documented use case requires otherwise.
- Show a configuration diff/preview, make a backup, and obtain explicit consent before writing files or environment settings.
- Never show credentials in logs. Mask secret fields and use OS credential storage where feasible.
- Connection checks must make real requests or run real supported diagnostics and report actual outcomes.

### 5.6 Skills manager
- Include a v1 Skills Manager if the current Claude Code skill format is confirmed by official documentation.
- List, inspect, import, validate, enable/disable where genuinely supported, and remove skills.
- Show source location and validation warnings.
- Never execute scripts or hooks merely because a skill is imported or enabled.
- Reject path traversal and unsafe archive paths; confirm overwrites and deletions.
- If skill support is not verified, keep the feature clearly marked experimental or pause for a product decision.

### 5.7 Settings and local data
- Theme preference and basic UI preferences.
- Session metadata and logs stored locally with clear retention/deletion controls.
- No hidden telemetry by default.
- Diagnostics export must be user-initiated, previewable, and redacted.

## 6. Non-functional requirements
- Cross-platform architecture with platform-specific process handling isolated behind adapters.
- Responsive UI that remains usable while the CLI runs.
- Accessible keyboard navigation, focus states, labels, and contrast.
- Secure process invocation and careful handling of secrets/untrusted output.
- Reproducible development setup, lockfiles, tests, and build instructions.
- Modular code with typed interfaces and useful error messages.

## 7. Success metrics
- User can detect or install Claude Code using guided instructions.
- User can choose a project, submit a prompt, see live output, and stop a session.
- No fake status or usage data is shown.
- Configuration changes are previewed and reversible.
- The automated test suite covers process failures, cancellation, unsafe input, and skill-import hazards.
- All claimed platform builds are actually built and tested, or gaps are disclosed.

## 8. Release scope
V1 should prioritize dependable CLI detection, safe launch/stream/stop, project selection, settings guidance, and a polished accessible UI. Add Skills Manager only with verified format support. Omni-Company remains pending until its link/repository is provided. MCP remains deferred.
