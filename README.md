<p align="center">
  <a href="https://loom.local">
    <img src="./assets/prod/loom-black-web-icon-192x192.png" width="80" height="80" alt="Loom logo" />
  </a>
</p>

<h1 align="center">Loom</h1>

<p align="center">The open-source control plane for coding agents.</p>

<p align="center">
  <a href="https://loom.local/download"><strong>Download</strong></a> ·
  <a href="https://apps.apple.com/us/app/loom-remote-claude-more/id6787819824">iOS</a> ·
  <a href="https://play.google.com/store/apps/details?id=com.loom.app">Android</a> ·
  <a href="https://app.loom.local">Web</a> ·
  <a href="./docs/README.md">Docs</a> ·
  <a href="https://discord.gg/jn4EGJjrvv">Discord</a>
</p>

<p align="center">
  <a href="https://loom.local">
    <img src="./.github/readme/hero.webp" width="100%" alt="Loom on desktop with a finished Claude thread, next to the phone app asking to approve a command from Codex" />
  </a>
</p>

Loom runs the coding agents on your machine and gives them one fast interface. Start a thread at your desk, then approve the next step from your phone.

It works with Claude Code, Codex, Cursor, OpenCode, Grok Build, Antigravity, Kiro, Pi, Muse Code, fx, and any [ACP](./docs/user/providers-acp.md) agent. If an agent is set up on your computer, Loom can control it.

## What you get

- **Your subscriptions.** Loom does not resell tokens. It drives the agents you are already signed in to.
- **Every agent in one place.** Change models in the middle of a thread. Let Claude hand a task to Codex.
- **Desktop, web, and phone.** One server, and every client shows the same threads. There are apps for iOS and Android.
- **Remote ready.** Run agents on any machine. Connect over your local network or a VPN.
- **Git built in.** Each thread can work in its own worktree. Review the diff, then commit, push, and open a pull request with one button.
- **Fast.** Performance is a feature here. We measure it, and we treat a dropped frame as a bug.
- **Open.** MIT licensed. If you don't like something, fork it.

## Install

### Desktop app

[Download Loom](https://loom.local/download) for macOS, Windows, or Linux. You can also use a package manager:

| Platform       | Command                                                              |
| -------------- | -------------------------------------------------------------------- |
| macOS          | `brew install --cask loom`                                        |
| Windows        | `winget install Loom.Loom` or `scoop install extras/loom`     |
| Arch Linux     | `yay -S loom-bin`                                                  |
| Nix            | `nix profile add github:NixOS/nixpkgs/nixos-unstable#loom`         |
| Debian, Ubuntu | `.deb` from [Releases](https://github.com/tarze07/Loom/releases) |

### Command line

This installs the `loom` command. Run `loom` to start the server and open the web app.

```bash
curl -fsSL https://loom.local/install.sh | sh
```

On Windows, in PowerShell:

```powershell
irm https://loom.local/install.ps1 | iex
```

To try it once without an install, run `npx t3@latest`.

### Phone

Get the app from the [App Store](https://apps.apple.com/us/app/loom-remote-claude-more/id6787819824) or [Google Play](https://play.google.com/store/apps/details?id=com.loom.app). Then follow [remote access](./docs/user/remote-access.md) to connect it to your computer.

### Sign in to an agent

Loom needs one agent that is installed and signed in. For example, install [Claude Code](https://claude.com/product/claude-code) and run `claude auth login`, or install [Codex CLI](https://developers.openai.com/codex/cli) and run `codex login`.

[Provider setup](./docs/user/install.md#providers) has the steps for each agent. [Install Loom](./docs/user/install.md) covers nightly builds, AppImage, WSL, and NixOS.

## "Wait, what are you selling me?"

Nothing. We built Loom because we wanted the best possible development experience with agents. We were inspired by existing solutions like the Codex desktop app, Conductor, Claude Desktop and Cursor Glass, but none met our bar.

We wanted something performant, remote-ready, and truly open. If we ever go the wrong direction, we want you to have everything you need to fork and build the tool that you want.

## Documentation

- [Install and first run](./docs/user/install.md)
- [Remote access from a phone or another machine](./docs/user/remote-access.md)
- [Permission modes](./docs/user/permission-modes.md)
- [Source control](./docs/user/source-control.md)
- [Connect outside agents over MCP](./docs/user/outside-agents.md)
- [FAQ](./docs/user/faq.md)

[All docs](./docs/README.md) has the full list.

## Contributing

We have limited review capacity. Small, focused fixes are the most likely to be merged. Features need an approved discussion first.

- Read [CONTRIBUTING.md](./CONTRIBUTING.md) before you report a bug or open a pull request.
- Put feature requests in [Ideas](https://github.com/tarze07/Loom/discussions/categories/ideas).
- Build from source with the [development runbook](./docs/operations/development.md#first-checkout). The [architecture overview](./docs/internals/overview.md) explains how it works.
- Get help in [Discord](https://discord.gg/jn4EGJjrvv).

## License

[MIT](./LICENSE)
