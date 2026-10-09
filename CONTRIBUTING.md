# Contributing to Nani

Thank you for your interest in contributing! Nani is a community-driven open-source project and all contributions are welcome.

## Code of Conduct

By participating, you agree to our [Code of Conduct](CODE_OF_CONDUCT.md).

## Ways to Contribute

- 🐛 **Report bugs** — Open an [issue](https://github.com/bindnero/nani/issues/new?template=bug_report.md)
- 💡 **Suggest features** — Open a [feature request](https://github.com/bindnero/nani/issues/new?template=feature_request.md)
- 📖 **Improve docs** — Fix typos, clarify instructions, add examples
- 🔧 **Fix bugs or implement features** — Submit a pull request

## Development Setup

```bash
git clone https://github.com/bindnero/nani.git
cd nani
npm install
npm run dev       # starts the Vite dev server with the native service plugin
```

Run tests before submitting any PR:

```bash
npm test
npm run typecheck
npm run lint
```

## Pull Request Guidelines

1. **Fork** the repository and create a **feature branch** from `master`:
   ```bash
   git checkout -b feat/my-feature
   ```

2. **Follow the existing code style** — TypeScript strict mode, React functional components, Tailwind CSS utility classes with design tokens.

3. **Write or update tests** for any changed behaviour in `src/**/*.test.tsx`.

4. **No fabricated data** — Never add mock status, token counts, costs, or tool events that a real CLI run would not produce. See `AGENTS.md` for the full implementation rules.

5. **Keep secrets out of code** — Never commit API keys, tokens, or credentials.

6. **One concern per PR** — Smaller, focused PRs are easier to review and merge faster.

7. Open a **draft PR** early if you'd like feedback on your approach before it's complete.

## Commit Messages

We use [Conventional Commits](https://www.conventionalcommits.org/):

```
feat: add session history persistence
fix: correct path detection on macOS arm64
docs: update README prerequisites
chore: upgrade vite to v8
```

## Architecture Notes

- `NaniBridge` is the abstraction layer between the UI and the OS. Any new OS interaction must go through it.
- Output is always rendered as inert plain text. Never inject HTML from CLI output.
- Design tokens live in `src/styles/index.css` — avoid hardcoded hex colours.

## Reporting Security Issues

Please do **not** open a public issue for security vulnerabilities.  
Email the maintainers directly or use [GitHub's private vulnerability reporting](https://github.com/bindnero/nani/security/advisories/new).

---

Thank you for helping make Nani better! 🎉
