<div align="center">
  <img src="public/favicon.png" alt="Nani Logo" width="80" height="80" />
  <h1>Nani</h1>
  <p><strong>Open-source desktop UI for Claude Code CLI</strong></p>
  <p>
    <a href="https://github.com/bindnero/nani/blob/master/LICENSE"><img alt="MIT License" src="https://img.shields.io/badge/license-MIT-blue.svg" /></a>
    <a href="https://github.com/bindnero/nani/releases"><img alt="Version" src="https://img.shields.io/badge/version-0.1.0-brightgreen.svg" /></a>
    <a href="https://github.com/bindnero/nani/issues"><img alt="Issues" src="https://img.shields.io/github/issues/bindnero/nani" /></a>
    <img alt="Platform" src="https://img.shields.io/badge/platform-Windows%20%7C%20macOS%20%7C%20Linux-lightgrey" />
    <img alt="Built with" src="https://img.shields.io/badge/built%20with-Tauri%20%2B%20React-purple" />
  </p>
</div>

---

Nani is a **local-first**, **open-source** desktop application that gives you a polished graphical interface to run and manage [Claude Code CLI](https://docs.claude.com/en/docs/claude-code) — Anthropic's powerful agentic coding tool — without leaving your desktop.

> **Nani controls Claude Code CLI. It does not replace it.**  
> All AI computation happens through your locally installed Claude Code binary using your own API key or credentials. Nani never touches your data or proxies your traffic.

---

## ✨ Features

| Feature | Description |
|---|---|
| 🖥️ **Native desktop app** | Built with Tauri + React. Runs as a real desktop window on Windows, macOS, and Linux |
| 🔍 **Auto-detection** | Automatically finds your Claude Code CLI across PATH and well-known install locations |
| 📂 **Project management** | Choose any folder as your working directory with live path validation |
| ⚡ **Live output streaming** | Real-time stdout/stderr streaming with auto-scroll, copy, and clear controls |
| 📊 **Structured activity panel** | Parses Claude Code's `stream-json` events into a readable activity timeline |
| 🛠️ **Custom CLI engines** | Add any CLI tool (not just Claude Code) and switch between them in the header |
| 🎨 **Dark / Light / System theme** | Full theme support with a premium dark-first design |
| 🔒 **Local-first / No telemetry** | No analytics, no tracking. Everything stays on your machine |
| 🚫 **No fabricated data** | Token counts, costs, and status are only shown when the CLI actually reports them |

---

## 🚀 Getting Started

### Prerequisites

- **Node.js** ≥ 18 and **npm** ≥ 9
- **Claude Code CLI** installed — see the [official setup guide](https://docs.claude.com/en/docs/claude-code/setup)
- *(Optional for desktop builds)* **Rust + Tauri CLI** — see [Tauri prerequisites](https://tauri.app/start/prerequisites/)

### Development (browser window)

```bash
git clone https://github.com/bindnero/nani.git
cd nani
npm install
npm run dev
```

Open [http://localhost:5173](http://localhost:5173) in your browser.  
The built-in Vite plugin (`naniNativeServicePlugin`) spawns real CLI processes so the app works fully without a Tauri shell during development.

### Desktop (Tauri)

```bash
npm run tauri:dev      # development with hot-reload
npm run tauri:build    # production binary
```

> **Windows note:** Ensure you have the [Tauri Windows prerequisites](https://tauri.app/start/prerequisites/#windows) (Visual C++ Build Tools, WebView2).

---

## 🏗️ Architecture

```
src/
├── components/          # Shared UI (Header, Sidebar, AppShell)
│   └── ui/              # Design system primitives (Button, Badge, Panel…)
├── features/
│   ├── workspace/       # Main session UI (ProjectPicker, PromptComposer, SessionOutput…)
│   ├── onboarding/      # CLI detection & auth setup flow
│   ├── skills/          # Claude Code skills manager
│   └── settings/        # Preferences & provider configuration
├── lib/
│   ├── bridge.ts        # NaniBridge interface (abstracts Tauri ↔ local node service)
│   ├── localNativeBridge.ts  # Web/dev bridge (calls Vite dev server API)
│   ├── mockBridge.ts    # In-memory bridge for unit tests
│   └── types.ts         # Shared TypeScript types
├── server/
│   └── nativeService.ts # Vite plugin: Node.js process spawner + SSE event stream
├── state/
│   └── appStore.ts      # Zustand global state
└── styles/
    └── index.css        # Design system tokens + animations
```

**Key design decisions:**
- The `NaniBridge` interface decouples UI from runtime — the same React components work in Tauri, browser dev mode, and unit tests.
- Output is rendered as inert plain text only — never as executable markup.
- No mock or fabricated data is ever shown. Status indicators only reflect real CLI output.

---

## 🧪 Testing

```bash
npm test              # run all tests (vitest)
npm run typecheck     # TypeScript type check
npm run lint          # ESLint
```

---

## 🤝 Contributing

Contributions are very welcome! Please read [CONTRIBUTING.md](CONTRIBUTING.md) before opening a PR.

Quick guide:
1. Fork the repo and create a branch: `git checkout -b feat/your-feature`
2. Make your changes and add tests where applicable
3. Ensure `npm test` and `npm run typecheck` pass
4. Open a pull request

Please follow the [Code of Conduct](CODE_OF_CONDUCT.md).

---

## 📋 Roadmap

- [x] Native OS folder picker (Windows Explorer dialog, macOS, Linux)
- [x] In-app folder selector modal with recent projects & quick shortcuts
- [x] Circular favicon and app icon (anti-aliased alpha mask)
- [x] Circular logo in sidebar with glow ring animation
- [x] Full open-source project setup (README, CONTRIBUTING, LICENSE, GitHub templates)
- [ ] Session history persistence
- [ ] Multi-session tabs
- [ ] macOS / Linux tested binary releases
- [ ] MCP (Model Context Protocol) server panel
- [ ] In-app provider / API key configuration

---

## 📄 License

[MIT](LICENSE) — © 2026 Nani contributors.

---

<div align="center">
  <sub>Built with ❤️ using <a href="https://tauri.app">Tauri</a>, <a href="https://react.dev">React</a>, <a href="https://tailwindcss.com">Tailwind CSS</a>, and <a href="https://zustand.pmnd.rs">Zustand</a></sub>
</div>
