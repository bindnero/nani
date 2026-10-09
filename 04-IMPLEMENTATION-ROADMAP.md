# Implementation Roadmap

## Phase 0 — Discovery and feasibility
**Work:** inspect repository/toolchain; read current official Claude Code CLI documentation; confirm supported programmatic/streaming mode; establish platform requirements; identify licensing and integration risks.
**Deliverables:** repository/environment report, technical plan, unknowns register.
**Exit gate:** no guessed CLI flags, provider API, or Omni-Company behavior.

## Phase 1 — Foundation
**Work:** initialize or adapt Tauri + React app; navigation; design tokens; error boundary; typed service interfaces; local settings storage.
**Tests:** app launch, navigation, persistence, lint/typecheck.
**Exit gate:** clean local development build and basic tests pass.

## Phase 2 — CLI detection and onboarding
**Work:** executable discovery, version check, missing-install guidance, retry, diagnostics.
**Tests:** CLI present/absent, invalid path, permission error, PATH variations.
**Exit gate:** UI reports only verified detection results.

## Phase 3 — Workspace and process lifecycle
**Work:** native folder picker, prompt composer, safe launch, streaming, Stop/cancel, exit status, bounded logs.
**Tests:** fake CLI output, stderr, Unicode, long output, nonzero exit, cancellation, shell-injection attempts.
**Exit gate:** stable integration tests; manual smoke test with real local Claude Code if available.

## Phase 4 — Provider settings
**Work:** configuration view, preview/diff, backup, consented apply, verification, rollback.
**Tests:** cancellation leaves config unchanged; backup failure blocks write; secrets are redacted.
**Exit gate:** official compatibility verified for each selectable route.

## Phase 5 — Skills Manager
**Work:** implement only against confirmed Claude Code skill formats and locations; import, inspect, validate, enable/disable if supported, remove.
**Tests:** malformed metadata, traversal, archive paths, duplicate names, overwrite confirmation, script-not-executed guarantee.
**Exit gate:** no automatic execution of imported content.

## Phase 6 — Omni-Company integration assessment
**Blocked until:** user supplies the official link or GitHub URL.
**Work after link arrives:** inspect project, license, docs, endpoints, auth, compatibility, security, maintenance. Produce a short integration assessment and request approval for any materially different scope.
**Exit gate:** no implementation based on invented API assumptions.

## Phase 7 — Cross-platform polish and packaging
**Work:** accessibility, OS-specific process cleanup, credential store integration, packaging and developer docs.
**Tests:** run builds on available OSes; document untested targets honestly.
**Exit gate:** release checklist complete or known gaps clearly documented.

## Phase 8 — Local user acceptance
**Work:** provide local build/run instructions; user tests on their own machine; collect and fix reported issues; rerun tests.
**Exit gate:** user confirms readiness.

## Phase 9 — Optional publication
Only after explicit user approval: verify MIT and dependency licenses, scan secrets, review README and build claims, confirm repository visibility, then create/push/release as authorized. Never publish automatically.
