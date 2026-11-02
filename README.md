# DevPulse

DevPulse is a local interactive terminal dashboard for configuring, starting, and supervising development services. It is not a hosted service: it has no database, network API, account system, or telemetry backend.

## Requirements and support

- Node.js 22 or newer.
- An interactive terminal with stdin and stdout attached. DevPulse requires at least 60 columns by 18 rows for its screens.
- CI currently verifies Linux (Ubuntu) on Node.js 22 and 24. Other operating systems and terminal emulators have not yet been qualified.

## Install and run

After the package is published:

```sh
npm install --global devpulse
devpulse
```

To run from a source checkout:

```sh
npm ci
npm run build
npm link
```

Run DevPulse from the workspace whose services you want to manage. If that directory has no profile, the setup wizard can create one. Existing profiles are discovered in the current directory; use an explicit path to select one:

```sh
devpulse --config ./config.devpulse.json
devpulse -c ./staging.devpulse.json
```

New profiles are saved separately rather than replacing an existing profile. Editing an existing profile writes a backup alongside it with the `.bak` suffix. Keep profile files under version control only if their commands and arguments contain no secrets.

## Command trust and environment

Service commands are executable shell input. DevPulse starts them with the current user's permissions, in each service's configured working directory, and with the current process environment. A profile can run arbitrary commands; the command-review screen is a review checkpoint, **not a sandbox**. Inspect profiles before approving them, especially profiles obtained from another person, repository, or download.

DevPulse does not read `.env` files or provide secret storage. Environment variables already present in the DevPulse process are inherited by child processes. Avoid putting credentials in command strings or profile files.

Services can be stopped from the dashboard. DevPulse also attempts to stop managed child-process trees when the application exits or receives Ctrl+C/SIGTERM. Do not treat this as a supervisor for production workloads: closing DevPulse stops its managed development processes.

## Configuration

Profiles are JSON files. The optional `$schema` property enables editor assistance and points to the published [configuration schema](./schema/devpulse.schema.json). The schema describes structural constraints; DevPulse also checks duplicate service names, dependency references, and dependency cycles at load time.

```json
{
  "$schema": "https://raw.githubusercontent.com/pawanbarbate/node-terminal/main/schema/devpulse.schema.json",
  "name": "local-stack",
  "version": "1.0.0",
  "settings": {
    "bootStaggerMs": 500,
    "maxConcurrentBoot": 3
  },
  "services": [
    {
      "name": "api",
      "path": "./services/api",
      "command": "npm run dev",
      "port": 4000,
      "autoStart": true,
      "readyPattern": "listening"
    },
    {
      "name": "web",
      "path": "./apps/web",
      "preStart": ["npm ci"],
      "command": "npm run dev",
      "port": 3000,
      "autoStart": true,
      "dependsOn": ["api"]
    }
  ]
}
```

### Root fields

| Field | Type | Meaning |
| --- | --- | --- |
| `$schema` | string, optional | Editor schema URL. |
| `name` | string, optional | Human-readable profile name. |
| `version` | string, optional | User-defined profile version. |
| `settings.bootStaggerMs` | non-negative integer, optional | Delay between startup waves. |
| `settings.maxConcurrentBoot` | positive integer, optional | Maximum concurrent service starts. |
| `services` | array, required | Services to display and optionally start. An empty array is valid. |

### Service fields

| Field | Type | Meaning |
| --- | --- | --- |
| `name` | non-empty string, required | Unique service label (case-insensitive). |
| `path` | non-empty string, required | Working directory, absolute or relative to the workspace where DevPulse is run. |
| `command` | non-empty string or non-empty string array | Main shell command. In an array, preceding entries run sequentially as one-shot commands and the final entry is the long-running command. |
| `commands` | non-empty string array, optional | Legacy/alternate command pipeline; takes precedence over `command` and `preStart` when present. |
| `preStart` | non-empty string array, optional | Commands run sequentially before the main command. |
| `dependsOn` | string array, optional | Names of services that must be running first. |
| `port` | integer from 1 to 65535, optional | TCP port DevPulse waits for when determining startup readiness. |
| `readyPattern` | string, optional | Text pattern in output used as the service readiness signal. |
| `autoStart` | boolean, optional | Whether the service starts with the dashboard; defaults to `true`. |

At least one of `command`, `commands`, or `preStart` must contain a runnable command. If both `port` and `readyPattern` are present, DevPulse waits for `readyPattern` in service output. Service paths must exist when a service is started.

## Terminal behavior and logs

- Resize the terminal if DevPulse displays its minimum-size notice.
- `NO_COLOR`, `FORCE_COLOR=0`, and `TERM=dumb` disable DevPulse's custom color control sequences. Ink styles follow the terminal's color support.
- Set `INK_SCREEN_READER=true` to let Ink use its screen-reader output mode; DevPulse disables custom alternate-screen and mouse controls in that mode.
- Application logs are written to `logs/app.log`, capped at 5 MiB with one rotated backup (`logs/app.log.1`). Runtime service output is shown in the dashboard and bounded in memory.
- The dashboard reports service/process state and logs. It does not measure CPU, memory, or network usage.

## Development and verification

```sh
npm ci
npm run check
npm test
npm run build
npm run package:smoke
```

`npm test` runs every test script. Tests that write configuration, logs, or fixture data use temporary directories and clean them up. `npm run package:smoke` packs the built CLI, installs it into a temporary consumer directory, and verifies the installed command's non-interactive guard.

## Troubleshooting

- **“requires an interactive TTY”**: run DevPulse directly in a terminal rather than redirecting stdin/stdout or invoking it from a non-interactive job.
- **A service is blocked or stopped**: verify its configured path, command, port/readiness output, and dependencies. Review the service logs for the first failing command.
- **A profile is invalid**: use the selector's validation message and compare it with the schema. Dependency names must refer to existing services and dependency graphs cannot contain cycles.
- **A terminal looks incorrect**: use a supported interactive terminal, resize to at least 60×18, and try disabling color with `NO_COLOR=1`.

## Release notes

The npm package name `devpulse` is already published and currently points to a different repository. Do not publish this package under that name unless ownership is verified; choose a new scoped or unscoped name first. Also confirm package author/contact and ISC license attribution before release. See [release and rollback guidance](./docs/release.md).
