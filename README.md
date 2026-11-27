<p align="center">
  <img src="assets/mustro-cockpit.svg" alt="MUSTRO — One command, your whole stack" width="640">
</p>

# MUSTRO

**One command, your whole stack.**  
A fast, mouse-interactive terminal cockpit for orchestrating local microservices, monorepos, and full-stack apps.

Running a modern stack shouldn't mean juggling six terminal tabs, guessing boot order, or grepping through tangled stdout. MUSTRO brings every service, pipeline, and log stream into one calm workspace—so you can launch, observe, and debug your entire system without leaving the terminal.

---

## ⚡ Why MUSTRO

- **Dependency-ordered boot** — Resolves `dependsOn` graphs automatically and verifies TCP port readiness before starting downstream services.
- **Pre-flight pipelines** — Run migrations, codegen, or builds sequentially (`preStart`) before a service's main process starts.
- **Mouse-first terminal UI** — Click service cards and tabs, scroll with the wheel, drag-select log text, and copy to your system clipboard (with OSC 52 fallback for SSH/tmux).
- **Structured log telemetry** — Unified live log stream with instant search, service filtering, fullscreen zoom, and inline expandable JSON trees.
- **Zero-config onboarding & profiles** — Auto-detects Node.js services in your repo, or switches between `*.mustro.json` environment profiles on the fly.
- **Clean teardown** — Terminates full process trees on exit across macOS, Linux, and Windows—no orphaned ports or zombie watchers.

---

## 📦 Quick Start

**Requires:** Node.js `>= 22.0.0` in a TrueColor terminal (iTerm2, Ghostty, Kitty, Alacritty, WezTerm, Windows Terminal, or VS Code).

```bash
# Run immediately without installing
npx mustro

# Or install globally
npm install -g mustro
```

### CLI Usage

```bash
mustro                          # Auto-detect config or launch the setup wizard
mustro -c ./staging.mustro.json # Launch with a specific config file
mustro -v                       # Print version
mustro -h                       # Show CLI options
```

---

## ⚙️ Configuration

MUSTRO automatically discovers `mustro.json`, `mustro.config.json`, `config.mustro.json`, or any `*.mustro.json` profile in your working directory.

```json
{
  "name": "Acme Commerce",
  "settings": {
    "bootStaggerMs": 400,
    "maxConcurrentBoot": 3
  },
  "services": [
    {
      "name": "db-migrate",
      "path": "./services/database",
      "command": "npm run migrate"
    },
    {
      "name": "api",
      "path": "./services/api",
      "preStart": ["npm run build:types"],
      "command": "npm run dev",
      "port": 4000,
      "dependsOn": ["db-migrate"]
    },
    {
      "name": "web",
      "path": "./apps/web",
      "command": "npm run dev",
      "port": 3000,
      "dependsOn": ["api"]
    }
  ]
}
```

### Options Reference

**`settings`**

| Key | Type | Default | Description |
| :--- | :--- | :--- | :--- |
| `bootStaggerMs` | `number` | `400` | Delay (ms) between starting services in the same dependency tier |
| `maxConcurrentBoot` | `number` | `2` | Maximum number of services booting simultaneously |

**`services[]`**

| Key | Type | Required | Description |
| :--- | :--- | :--- | :--- |
| `name` | `string` | Yes | Unique service identifier |
| `path` | `string` | Yes | Service working directory (relative or absolute) |
| `command` | `string \| string[]` | Yes | Command or command pipeline to run |
| `preStart` | `string[]` | No | Sequential pre-flight commands executed before `command` |
| `port` | `number` | No | TCP port probed to verify readiness before dependents boot |
| `dependsOn` | `string[]` | No | Upstream service names required before this service starts |
| `readyPattern` | `string` | No | Log pattern used to detect service readiness |
| `autoStart` | `boolean` | No | Start automatically on launch (default: `true`) |

---

## ⌨️ Essential Controls

| Input | Action |
| :--- | :--- |
| <kbd>↑</kbd> <kbd>↓</kbd> / <kbd>j</kbd> <kbd>k</kbd> | Navigate services or scroll logs |
| <kbd>1</kbd> <kbd>2</kbd> / <kbd>←</kbd> <kbd>→</kbd> | Switch detail tabs (Logs, Errors) |
| <kbd>r</kbd> / <kbd>s</kbd> | Restart or Start/Stop selected service |
| <kbd>/</kbd> / <kbd>f</kbd> | Search logs / cycle service filter |
| <kbd>v</kbd> / <kbd>Space</kbd> / <kbd>Enter</kbd> | Expand or collapse JSON log entry |
| <kbd>z</kbd> / <kbd>w</kbd> | Toggle fullscreen zoom / line wrap |
| <kbd>c</kbd> | Copy selected logs to clipboard |
| <kbd>p</kbd> | Switch configuration profile |
| <kbd>?</kbd> | Open full in-app shortcut reference |
| <kbd>q</kbd> / <kbd>Ctrl+C</kbd> | Stop all services and exit |

> Mouse clicks, scroll wheel, and drag-to-select work across all panels.

---

## 🛠️ Development

```bash
git clone https://github.com/pawanbarbate/Mustro.git
cd Mustro
npm install
npm run dev    # Run from TypeScript source
npm test       # Run test suite
npm run build  # Build production bundle
```

## 📄 License

Released under the [MIT License](LICENSE).
