# Contributing to Rüke

Thanks for your interest in contributing! Rüke is open source and welcomes contributions of all kinds — bug reports, feature requests, documentation improvements, and code.

## Getting Started

1. Fork the repository
2. Clone your fork:
   ```bash
   git clone https://github.com/<your-username>/ruke.git
   cd ruke
   ```
3. Install dependencies:
   ```bash
   npm install
   ```
4. Start the dev environment:
   ```bash
   npm run dev      # Watches main + renderer
   npm start        # In a separate terminal, launches Electron
   ```

## Development

### Project Structure

```
src/
  main/           Electron main process (HTTP engine, SQLite, AI)
  renderer/       React UI (components, stores, styles)
  shared/         Shared types and constants
  preload/        Electron preload script (IPC bridge)
```

### Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start dev servers (main + renderer) |
| `npm start` | Launch Electron with compiled main process |
| `npm run build` | Build main + renderer for production |
| `npm run dist` | Build and package with electron-builder |
| `npm run typecheck` | Run TypeScript type checking |

### Code Style

- TypeScript strict mode is enabled
- Use functional components with hooks in React
- State management via Zustand stores
- Tailwind CSS for styling, Radix UI for accessible primitives

## Submitting Changes

1. Create a branch from `main`:
   ```bash
   git checkout -b feat/your-feature
   ```
2. Make your changes and verify they compile:
   ```bash
   npm run typecheck
   ```
3. Commit with a descriptive message:
   ```bash
   git commit -m "feat: add request duplication"
   ```
4. Push and open a pull request against `main`

### Commit Convention

We loosely follow [Conventional Commits](https://www.conventionalcommits.org/):

- `feat:` — new feature
- `fix:` — bug fix
- `docs:` — documentation
- `refactor:` — code change that neither fixes a bug nor adds a feature
- `chore:` — tooling, deps, CI

## Reporting Bugs

Open an issue with:

- Steps to reproduce
- Expected vs actual behavior
- OS and Rüke version
- Screenshots if applicable

## Feature Requests

Open an issue describing the use case. Explain *why* you need it, not just *what* you want — this helps us design the right solution.

## License

By contributing, you agree that your contributions will be licensed under the MIT License.
