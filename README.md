<p align="center">
  <h1 align="center">Rüke</h1>
  <p align="center">
    <strong>Talk to your APIs. Share with your team. Works offline. Always.</strong>
  </p>
  <p align="center">
    <a href="https://github.com/cdvillegas/ruke/releases"><img alt="GitHub Release" src="https://img.shields.io/github/v/release/cdvillegas/ruke?style=flat-square"></a>
    <a href="LICENSE"><img alt="License: MIT" src="https://img.shields.io/badge/license-MIT-blue?style=flat-square"></a>
    <a href="https://github.com/cdvillegas/ruke/actions"><img alt="CI" src="https://img.shields.io/github/actions/workflow/status/cdvillegas/ruke/ci.yml?style=flat-square&label=CI"></a>
  </p>
</p>

---

Rüke is an open-source, AI-native API client built to replace Postman. No forced accounts, no cloud lock-in, no telemetry. Your data stays on your machine.

<!-- TODO: Add screenshot here once the app UI is polished -->
<!-- ![Rüke Screenshot](assets/screenshot.png) -->

## Install

### Download

Grab the latest release for your platform from [GitHub Releases](https://github.com/cdvillegas/ruke/releases):

| Platform | Format |
|----------|--------|
| macOS    | `.dmg` |
| Windows  | `.exe` (NSIS installer) |
| Linux    | `.AppImage` |

### Build from Source

```bash
git clone https://github.com/cdvillegas/ruke.git
cd ruke
npm install
npm run dist
```

Packaged binaries will be in `release/`.

## Why Rüke

- **Offline-first** — Everything works without internet. No forced cloud sync. Your requests, environments, and history live in a local SQLite database.
- **AI-native** — Describe requests in plain English. AI explains errors, generates request bodies, and suggests fixes. Bring your own OpenAI key.
- **Environments that don't suck** — Always visible, scoped (Global > Collection > Folder > Request), diffable, with secret variable support.
- **Team-friendly** — Export `.ruke` files. Git-friendly JSON format. Share via Slack, email, or version control.
- **Postman import** — One-click import of Postman collections and environments.
- **Open source** — MIT licensed. Audit the code. No telemetry. No account required. Ever.

## Development

```bash
npm install
npm run dev        # Watches main + renderer
npm start          # In a separate terminal, launches Electron
```

See [CONTRIBUTING.md](CONTRIBUTING.md) for the full development guide.

### Project Structure

```
src/
  main/           Electron main process (HTTP engine, SQLite, AI service)
  renderer/       React UI (components, stores, styles)
  shared/         Shared types and constants
  preload/        Electron preload script (IPC bridge)
```

### Tech Stack

- **Electron** + **React 19** + **TypeScript**
- **Tailwind CSS 4** + **Radix UI** for accessible, modern UI
- **SQLite** (better-sqlite3) for local-first storage
- **Zustand** for state management
- **CodeMirror 6** for syntax-highlighted editors
- **OpenAI SDK** for AI features (bring your own key)

## Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `⌘/Ctrl + Enter` | Send Request |
| `⌘/Ctrl + K` | Command Palette |
| `⌘/Ctrl + I` | Toggle AI Panel |
| `⌘/Ctrl + N` | New Request |
| `⌘/Ctrl + S` | Save Request |

## Roadmap

- [ ] Auto-updates via GitHub Releases
- [ ] Homebrew Cask formula
- [ ] WebSocket & SSE support
- [ ] Request scripting (pre-request / post-response)
- [ ] Team cloud sync (optional, paid tier)
- [ ] Plugin system

## Contributing

Contributions are welcome! See [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines.

## License

[MIT](LICENSE) — free for personal and commercial use.
