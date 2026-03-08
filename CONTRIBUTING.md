# Contributing to Rüke

Thank you for your interest in contributing to Rüke. Whether it's a bug report, feature request, documentation improvement, or code — every contribution matters.

## Table of Contents

- [Getting Started](#getting-started)
- [Development Setup](#development-setup)
- [Project Structure](#project-structure)
- [Making Changes](#making-changes)
- [Code Standards](#code-standards)
- [Commit Convention](#commit-convention)
- [Pull Requests](#pull-requests)
- [Reporting Bugs](#reporting-bugs)
- [Requesting Features](#requesting-features)
- [Community](#community)

## Getting Started

1. **Fork** the repository on GitHub
2. **Clone** your fork locally:

```bash
git clone https://github.com/<your-username>/ruke.git
cd ruke
```

3. **Install** dependencies:

```bash
npm install
```

4. **Start** the development environment:

```bash
npm run dev          # Watches main + renderer processes
npm start            # In a separate terminal, launches Electron
```

## Development Setup

### Prerequisites

| Tool | Version |
|:--|:--|
| Node.js | >= 20.x |
| npm | >= 10.x |
| Git | >= 2.x |
| Python | 3.x (required by `better-sqlite3` native build) |

On macOS, you'll also need Xcode Command Line Tools:

```bash
xcode-select --install
```

### Available Scripts

| Command | Description |
|:--|:--|
| `npm run dev` | Start dev servers (main + renderer in watch mode) |
| `npm start` | Launch Electron with the compiled main process |
| `npm run build` | Build main + renderer for production |
| `npm run build:cli` | Build the standalone CLI tool |
| `npm run dist` | Build and package with electron-builder |
| `npm run typecheck` | Run TypeScript type checking across the project |

### Hot Reload

- **Renderer** — Vite provides instant hot module replacement. Changes to React components and styles are reflected immediately.
- **Main process** — TypeScript is compiled in watch mode. Restart Electron (`npm start`) to pick up main process changes.

## Project Structure

```
src/
├── main/                       Electron main process
│   ├── ai/                     AI service, prompts, model configuration
│   ├── agent/                  API discovery, public registry, API search
│   ├── db/                     SQLite schema definition and repository layer
│   ├── grpc/                   gRPC engine (unary, server streaming)
│   ├── http/                   HTTP engine (fetch-based, proxy, redirects)
│   ├── scripting/              Sandboxed JS runtime for pre/post scripts
│   └── index.ts                IPC handlers, window management, app lifecycle
├── renderer/                   React 19 UI
│   ├── components/             Feature-organized component tree
│   │   ├── chat/               AI chat interface and sidebar
│   │   ├── collections/        Collection tree, import/export, runner
│   │   ├── connections/        gRPC connection management
│   │   ├── environment/        Environment editor and switcher
│   │   ├── history/            Request history viewer
│   │   ├── home/               Home/welcome screen
│   │   ├── layout/             App shell: nav rail, sidebar, top bar, AI panel
│   │   ├── onboarding/         First-run onboarding flow
│   │   ├── request/            Request builder, auth, body, headers, scripts
│   │   ├── requests/           Agent panel, request sidebar
│   │   ├── response/           Response viewer (body, headers, cookies)
│   │   ├── settings/           Settings, proxy config, defaults
│   │   └── shared/             Reusable UI primitives
│   ├── lib/                    Agent runner, agent tools, IPC bridge
│   └── stores/                 Zustand state stores
├── shared/                     Types, constants, spec parser, cURL utilities
├── preload/                    Electron preload script (IPC bridge)
└── cli/                        Standalone Node.js CLI for headless execution
```

### Key Concepts

- **IPC bridge** — All communication between the renderer and main process goes through typed IPC channels defined in `src/shared/constants.ts`. The preload script (`src/preload/index.ts`) exposes a `window.ruke` API.
- **Stores** — Application state lives in Zustand stores (`src/renderer/stores/`). Each domain (requests, collections, environments, chat, UI) has its own store.
- **Agent tools** — AI tools are defined in `src/renderer/lib/agentTools.ts` using Zod schemas. The agent runner orchestrates tool execution in `src/renderer/lib/agentRunner.ts`.

## Making Changes

1. **Create a branch** from `main`:

```bash
git checkout -b feat/your-feature
```

2. **Make your changes** and verify they compile:

```bash
npm run typecheck
```

3. **Test manually** by running the app:

```bash
npm run dev
npm start
```

4. **Commit** with a descriptive message (see [Commit Convention](#commit-convention))

5. **Push** and open a pull request against `main`

## Code Standards

### TypeScript

- Strict mode is enabled. Do not use `any` unless absolutely necessary.
- Prefer `interface` over `type` for object shapes.
- Use explicit return types on exported functions.

### React

- Functional components with hooks — no class components.
- Co-locate related components in feature directories.
- Use Zustand for shared state. Avoid prop drilling beyond 2 levels.

### Styling

- **Tailwind CSS 4** for all styling. Avoid inline styles and CSS modules.
- **Radix UI** for accessible, unstyled primitives (dialogs, dropdowns, tabs, etc.).
- Use the existing color palette and spacing scale. Check existing components for patterns.

### File Naming

| Type | Convention | Example |
|:--|:--|:--|
| Component | PascalCase | `RequestBuilder.tsx` |
| Store | camelCase | `requestStore.ts` |
| Utility | camelCase | `agentRunner.ts` |
| Types | camelCase | `types.ts` |

## Commit Convention

We follow [Conventional Commits](https://www.conventionalcommits.org/):

| Prefix | Usage |
|:--|:--|
| `feat:` | New feature |
| `fix:` | Bug fix |
| `docs:` | Documentation only |
| `refactor:` | Code change that neither fixes a bug nor adds a feature |
| `perf:` | Performance improvement |
| `test:` | Adding or updating tests |
| `chore:` | Tooling, dependencies, CI configuration |
| `style:` | Formatting, whitespace (no logic change) |

Write the subject line in imperative mood: "add request duplication", not "added" or "adds".

## Pull Requests

- Keep PRs focused. One feature or fix per PR.
- Fill out the PR template with a summary and test plan.
- Ensure `npm run typecheck` passes before requesting review.
- Link related issues using `Closes #123` in the PR description.
- Be responsive to review feedback.

## Reporting Bugs

Open an [issue](https://github.com/cdvillegas/ruke/issues/new) with:

- **Steps to reproduce** — Minimal, concrete steps
- **Expected behavior** — What should happen
- **Actual behavior** — What happens instead
- **Environment** — OS, Rüke version, Node.js version
- **Screenshots** — If the issue is visual

## Requesting Features

Open an [issue](https://github.com/cdvillegas/ruke/issues/new) and describe:

- **The problem** you're trying to solve (not just the solution you want)
- **Your current workaround**, if any
- **How it would work** from a user's perspective

This helps us design the right solution rather than just implementing a specific request.

## Community

- Be respectful and constructive. See our [Code of Conduct](CODE_OF_CONDUCT.md).
- Ask questions by opening a [Discussion](https://github.com/cdvillegas/ruke/discussions) or Issue.
- If you're unsure whether something is a bug or intended behavior, ask first.

## License

By contributing, you agree that your contributions will be licensed under the [MIT License](LICENSE).
