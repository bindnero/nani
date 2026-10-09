# Nani — Claude Code Desktop UI

## Purpose
Nani is an open-source desktop interface for working with Anthropic's Claude Code CLI locally. The implementation tool (for example, OpenCode) is separate from the runtime agent: Nani controls Claude Code, not OpenCode.

## Read first
Read every document in this bundle before implementation. Follow `AGENTS.md` as the coding-agent instruction file.

## Confirmed direction
- Desktop framework: Tauri + React.
- Targets: Windows, macOS, and Linux.
- Open-source license: MIT.
- Runtime: locally installed Claude Code CLI.
- Omni-Company service: integration is not specified yet; the user will provide a link or GitHub URL later. Do not guess its API, product identity, endpoints, or behavior.
- MCP: defer unless separately approved.
- Build and test locally first. Do not push to GitHub, create a public repository, or publish releases until the user explicitly approves after testing.

## Non-negotiable engineering rules
1. Inspect the existing repository and environment before changing files.
2. Read all specifications before coding.
3. Never fabricate progress, tool events, token counts, cost, or connection status.
4. Use safe process APIs and argument arrays; do not concatenate prompts into shell commands.
5. Never silently edit Claude Code or provider configuration. Preview changes, back up affected files, and ask for consent.
6. Do not execute imported skill scripts automatically.
7. Do not claim a feature or test works unless it was actually run and verified.
8. Ask before destructive changes or external publication.

## Recommended build sequence
Follow `05-IMPLEMENTATION-ROADMAP.md`, then validate with `06-ACCEPTANCE-CRITERIA.md`.
