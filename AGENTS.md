# AGENTS.md — Instructions for Coding Agents

You are implementing Nani, an open-source desktop UI for controlling the locally installed Claude Code CLI, using Tauri + React.

## Before coding
1. Read every Markdown specification in this directory.
2. Inspect the existing repository, git status, operating system, installed toolchains, and package scripts.
3. Do not overwrite existing user work without review.
4. Research current official Claude Code CLI documentation before choosing flags, output modes, or configuration keys.
5. Create a phased plan and list unresolved decisions.

## Product boundaries
- Nani controls Claude Code CLI; it does not use OpenCode as its runtime agent.
- Omni-Company details are not yet provided. Do not invent endpoints, APIs, features, or compatibility. Wait for the official URL/GitHub repository before assessing integration.
- Tauri + React is the selected desktop framework.
- MCP is deferred unless separately approved.
- Target platforms are Windows, macOS, and Linux, but only claim platforms actually tested.
- MIT license.

## Implementation rules
- Use structured process arguments, never shell-concatenate user input.
- Never fabricate status, progress, tool activity, token counts, or cost.
- Never silently modify Claude Code/provider configuration; preview, back up, ask consent, verify, and support rollback.
- Never execute imported skill scripts automatically.
- Keep secrets out of logs, commits, and diagnostics.
- Add tests for each phase and report exact results.
- Ask before destructive changes.
- Build and test locally first. Do not create a public repository, push, or publish a release until the user explicitly approves after local testing.
