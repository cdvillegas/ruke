# Security Policy

## Supported Versions

| Version | Supported |
|:--|:--|
| Latest release | Yes |
| Previous releases | Best effort |

## Reporting a Vulnerability

If you discover a security vulnerability in Rüke, **please do not open a public issue.**

Instead, report it privately:

1. **Email**: Send details to the maintainer via [GitHub private vulnerability reporting](https://github.com/cdvillegas/ruke/security/advisories/new)
2. Include a description of the vulnerability, steps to reproduce, and potential impact

We will acknowledge receipt within **48 hours** and provide a timeline for a fix.

## Scope

The following are in scope for security reports:

- Remote code execution via crafted `.ruke` import files or Postman imports
- Data exfiltration from the local SQLite database
- Script sandbox escapes in the pre-request / post-response scripting engine
- IPC channel vulnerabilities in the Electron preload bridge
- Credential leakage (API keys, OAuth tokens, environment secrets)

## Security Design

Rüke is designed with security as a priority:

- **Local-first** — All data is stored in a local SQLite database. No data is transmitted to external servers unless explicitly requested by the user (e.g., sending an API request or using AI features with a user-provided API key).
- **No telemetry** — Zero analytics, tracking, or usage data collection.
- **No accounts** — No authentication server, no user accounts, no cloud dependency.
- **Sandboxed scripting** — Pre-request and post-response scripts run in a Node.js `vm` sandbox with restricted access.
- **Context isolation** — Electron's context isolation is enabled. The renderer process communicates with the main process exclusively through typed IPC channels.
- **Secret variables** — Environment variables marked as secrets are masked in the UI and excluded from exports.

## Disclosure Policy

- We follow [coordinated vulnerability disclosure](https://en.wikipedia.org/wiki/Coordinated_vulnerability_disclosure).
- Security fixes are released as patch versions with a brief advisory.
- Credit is given to reporters unless they prefer to remain anonymous.
