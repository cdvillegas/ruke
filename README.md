<div align="center">

<br />

# Rüke

**The AI-Native API Client**

Talk to your APIs. Share with your team. Works offline. Always.

[![GitHub Release](https://img.shields.io/github/v/release/cdvillegas/ruke?style=for-the-badge&logo=github&color=161b22)](https://github.com/cdvillegas/ruke/releases)
[![License: MIT](https://img.shields.io/badge/license-MIT-3da639?style=for-the-badge&logo=opensourceinitiative&logoColor=white)](LICENSE)
[![CI](https://img.shields.io/github/actions/workflow/status/cdvillegas/ruke/ci.yml?style=for-the-badge&logo=githubactions&logoColor=white&label=CI)](https://github.com/cdvillegas/ruke/actions)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.7-3178c6?style=for-the-badge&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Electron](https://img.shields.io/badge/Electron-33-47848f?style=for-the-badge&logo=electron&logoColor=white)](https://www.electronjs.org/)
[![React](https://img.shields.io/badge/React-19-61dafb?style=for-the-badge&logo=react&logoColor=black)](https://react.dev/)

[Download](#install) · [Features](#features) · [Documentation](#documentation) · [Contributing](CONTRIBUTING.md)

<!-- TODO: Replace with actual screenshot -->
<!-- <img src="assets/screenshot.png" alt="Rüke — AI-Native API Client" width="820" /> -->

</div>

<br />

---

## Why Rüke?

Rüke is an open-source API client engineered for developers who need power, privacy, and intelligence — without the baggage. No forced accounts, no cloud lock-in, no telemetry. Your data stays on your machine. Period.

| | Postman | Insomnia | Rüke |
|:--|:--:|:--:|:--:|
| Offline-first | Partial | Partial | **Full** |
| AI-native agent | — | — | **Built-in** |
| No account required | — | — | **Never** |
| gRPC support | Paid | Plugin | **Free** |
| WebSocket client | Basic | — | **Full** |
| Local-only storage | — | — | **SQLite** |
| Open source | — | Partial | **MIT** |
| CLI for CI/CD | Paid | — | **Free** |

<br />

## Features

### AI-Powered Workflow

Rüke doesn't just add AI as a sidebar — it's built around it. A full agentic AI system with **24+ tools** understands your workspace context and can build, modify, debug, and explain requests autonomously.

- **Natural language requests** — Describe what you want; the agent builds the request, headers, auth, and body
- **Error diagnosis** — AI reads response bodies, status codes, and headers to explain what went wrong and how to fix it
- **API discovery** — Automatically find and import APIs from public registries and OpenAPI specs
- **Script generation** — Describe test assertions in plain English; get executable pre-request and post-response scripts
- **Context-aware** — The agent sees your collections, environments, connections, and history

### Protocol Support

| Protocol | Capabilities |
|:--|:--|
| **HTTP/REST** | All methods, streaming, redirect chain tracking, binary bodies, multipart form-data |
| **GraphQL** | Query, mutation, variables, introspection |
| **gRPC** | Unary calls, server streaming, proto file management, service reflection |
| **WebSocket** | Connect, send/receive messages, custom headers, protocol negotiation |

### Authentication

Every auth flow you need, built in — not bolted on.

- **Bearer Token** / **Basic Auth** / **API Key** (header or query parameter)
- **OAuth 2.0** — Authorization Code (with PKCE), Client Credentials, Password Grant, Implicit
- All auth fields support **environment variable interpolation**

### Environments & Variables

- **Scoped hierarchy** — Global → Collection → Request
- **Secret variables** — Masked in the UI, never exported
- **Always visible** — Environment switcher is always one click away
- **Variable interpolation** — `{{variable}}` syntax everywhere: URLs, headers, body, auth fields

### Pre-Request & Post-Response Scripting

A sandboxed JavaScript runtime with a purpose-built API:

```javascript
// Pre-request: set dynamic values
rk.variables.set('timestamp', Date.now().toString());

// Post-response: validate and extract
rk.expect(response.status).toBe(200);
const token = response.json().access_token;
rk.variables.set('auth_token', token);
```

- `rk.expect()` assertion API with `toBe`, `toContain`, `toBeTruthy`, `toBeGreaterThan`, and more
- Access and modify environment variables across request chains
- Console output captured and displayed in the UI
- AI can generate scripts from natural language descriptions

### Collections & Collaboration

- **Collection runner** — Execute all requests in sequence with variable chaining and progress tracking
- **Import/Export** — `.ruke` files (JSON), Postman collections, cURL commands
- **Git-friendly** — Human-readable JSON format designed for version control
- **CLI** — Run collections headless in CI/CD pipelines with console, JSON, or JUnit output

### Developer Experience

- **Command palette** (`⌘K`) — Fast access to every action
- **Request history** — Every request logged with full response, searchable and restorable
- **Code generation** — Export any request as cURL
- **Proxy configuration** — HTTP proxy with authentication support
- **Configurable timeouts** — Per-request and global defaults
- **Response inspector** — Body (with syntax highlighting), headers, cookies, timing, redirect chain

<br />

## Install

### Download

Grab the latest release for your platform:

<div align="center">

| Platform | Format | |
|:--|:--|:--|
| **macOS** | `.dmg` | [Download](https://github.com/cdvillegas/ruke/releases) |
| **Windows** | `.exe` (NSIS installer) | [Download](https://github.com/cdvillegas/ruke/releases) |
| **Linux** | `.AppImage` | [Download](https://github.com/cdvillegas/ruke/releases) |

</div>

### Build from Source

```bash
git clone https://github.com/cdvillegas/ruke.git
cd ruke
npm install
npm run dist
```

Packaged binaries are output to `release/`.

### CLI

The Rüke CLI runs collections headless — perfect for CI/CD pipelines, automated testing, and scripted workflows.

```bash
# Build the CLI
npm run build:cli

# Run a collection
ruke run collection.ruke --env production.json --output junit --output-file results.xml

# With inline variables
ruke run collection.ruke --env-var "BASE_URL=https://api.example.com" --verbose
```

| Flag | Description |
|:--|:--|
| `--env <file>` | Environment file (JSON) |
| `--env-var <KEY=VALUE>` | Inline variable override |
| `--timeout <ms>` | Request timeout in milliseconds |
| `--bail` | Stop on first failure |
| `--output <format>` | `console` (default), `json`, `junit` |
| `--output-file <path>` | Write report to file |
| `--verbose` | Show request/response details |

<br />

## Documentation

### Keyboard Shortcuts

| Shortcut | Action |
|:--|:--|
| `⌘/Ctrl + Enter` | Send request |
| `⌘/Ctrl + K` | Command palette |
| `⌘/Ctrl + I` | Toggle AI panel |
| `⌘/Ctrl + N` | New request |
| `⌘/Ctrl + S` | Save request |

### Architecture

```
src/
├── main/                 Electron main process
│   ├── ai/               AI service & prompt engineering
│   ├── agent/            API discovery & registry
│   ├── db/               SQLite schema & repository
│   ├── grpc/             gRPC engine (unary + streaming)
│   ├── http/             HTTP engine (fetch-based)
│   └── scripting/        Sandboxed JS runtime for scripts
├── renderer/             React UI
│   ├── components/       Feature-organized components
│   ├── lib/              Agent runner, tools, utilities
│   └── stores/           Zustand state management
├── shared/               Cross-process types & constants
├── preload/              Electron IPC bridge
└── cli/                  Standalone CLI runner
```

### Tech Stack

| Layer | Technology |
|:--|:--|
| **Runtime** | Electron 33 |
| **Frontend** | React 19, TypeScript 5.7 |
| **Styling** | Tailwind CSS 4, Radix UI |
| **State** | Zustand |
| **Editor** | CodeMirror 6 |
| **Database** | SQLite (better-sqlite3) |
| **AI** | Vercel AI SDK, OpenAI SDK |
| **HTTP** | Native fetch / undici |
| **gRPC** | @grpc/grpc-js, protobufjs |
| **WebSocket** | ws |
| **Build** | Vite 6, electron-builder |

<br />

## Roadmap

- [x] HTTP/REST, GraphQL, gRPC support
- [x] AI agent with 24+ tools
- [x] Pre-request / post-response scripting
- [x] OAuth 2.0 with PKCE
- [x] WebSocket client
- [x] Collection runner
- [x] CLI for CI/CD
- [x] cURL import/export
- [ ] Auto-updates via GitHub Releases
- [ ] Homebrew Cask / winget / Snap packages
- [ ] Server-Sent Events (SSE)
- [ ] Plugin / extension system
- [ ] Team sync (optional, self-hosted or cloud)
- [ ] OpenAPI spec generation from requests
- [ ] Load testing and performance profiling
- [ ] API mocking server

<br />

## Contributing

We welcome contributions of all kinds — bug reports, feature requests, documentation, and code. See **[CONTRIBUTING.md](CONTRIBUTING.md)** for the full guide.

```bash
git clone https://github.com/cdvillegas/ruke.git
cd ruke
npm install
npm run dev          # Watch mode for main + renderer
npm start            # Launch Electron (separate terminal)
```

<br />

## Security

Found a vulnerability? Please report it responsibly. See **[SECURITY.md](SECURITY.md)** for our disclosure policy.

<br />

## License

[MIT](LICENSE) — free for personal and commercial use.

<br />

---

<div align="center">

**Built by [Chris Villegas](https://github.com/cdvillegas)**

If Rüke helps your workflow, consider giving it a star.

</div>
