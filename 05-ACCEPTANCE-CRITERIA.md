# Acceptance Criteria and Test Matrix

## Product acceptance
- [ ] App launches locally and primary navigation works.
- [ ] CLI presence/version is reported only when actually detected.
- [ ] Missing CLI screen provides official install guidance and retry.
- [ ] CLI detection is not confused with authentication/provider readiness.
- [ ] User can select a project folder and see the actual working path.
- [ ] Prompt launches Claude Code using a safe process API.
- [ ] Output streams progressively without freezing the UI.
- [ ] Stop/cancel produces a real final process status.
- [ ] stdout/stderr and Nani diagnostics are distinguishable.
- [ ] No fabricated tool events, tokens, cost, or progress.
- [ ] Provider configuration has preview, backup, consent, verification, and rollback behavior.
- [ ] Omni-Company is not treated as implemented before its official URL/repository is reviewed.
- [ ] Skill import rejects unsafe paths and never executes imported scripts.
- [ ] Logs and diagnostic exports redact secrets.
- [ ] No telemetry or source upload occurs without explicit consent.
- [ ] Windows/macOS/Linux support claims match actual test evidence.
- [ ] MIT license and dependency license review are included.
- [ ] No external publication occurs without explicit user approval.

## Required automated cases
- Process spawn succeeds/fails.
- Missing executable and version-check failure.
- stdout, stderr, Unicode, empty output, and large output.
- Nonzero exit and unexpected process termination.
- Stop request and termination escalation.
- Prompt/path strings containing shell metacharacters.
- Invalid project path and permission denial.
- Config preview/cancel/backup failure/rollback.
- Secret redaction in logs and diagnostics.
- Skill path traversal, archive traversal, symlink escape, malformed metadata, duplicate name, overwrite confirmation.
- CLI output is rendered as text, not HTML/script.

## Test report format
For every test run, record command, OS, date, exit code, and result. Mark tests as Passed, Failed, Skipped, or Not Run. Do not report skipped tests as passed.
