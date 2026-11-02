# Release and rollback

This procedure applies to the npm package currently named `devpulse`. **Launch blocker:** the npm registry already lists `devpulse@1.1.0`, whose repository metadata points to `lalitcap23/DevPulse`, not this repository. Do not publish using the current package name. Select a new scoped or unscoped name and update package metadata, lockfile, docs, and smoke-test expectations, or obtain verifiable control of the existing package before release.

## Before a release

1. Confirm the release owner, npm account, replacement package-name availability (or verified ownership of the existing name), and intended ISC license/copyright attribution.
2. Update the package version with `npm version <patch|minor|major>` after reviewing the changes and updating the changelog/release notes.
3. Review the diff for secrets, generated profiles, logs, test artifacts, and accidental fixture changes.
4. Run `npm ci`, `npm run check`, `npm test`, `npm run build`, `npm run package:smoke`, and `npm audit`.
5. Inspect `npm pack --dry-run` and confirm the archive contains the CLI, schema, README, and license metadata but no tests, logs, local configuration, or `node_modules`.
6. Merge the reviewed change to the default branch and wait for the Node 22/24 CI matrix to pass.

## Publish and verify

1. Create an annotated tag matching the package version, for example `v1.2.3`.
2. Publish from the reviewed release commit using the project's approved npm account and access policy.
3. Install the published version into a clean temporary directory and verify the displayed version in an interactive terminal and the non-interactive TTY guard in automation.
4. Verify the npm `latest` tag points to the intended version and retain the CI run, package tarball metadata, and release notes.

## Rollback

1. Stop promotion of the faulty version and identify the last known-good version from npm and the release tags.
2. Restore the npm `latest` tag to that version with `npm dist-tag add devpulse@<known-good-version> latest`.
3. Publish a patched version rather than reusing or overwriting a published version.
4. If profile compatibility is involved, preserve user profile files and document any manual recovery; do not recommend deleting profiles as a rollback step.
5. Record the incident, affected versions, mitigation, and follow-up verification in the release notes.

Publishing credentials must be stored in the repository’s protected release environment, not in source files or workflow logs. This workflow intentionally does not publish automatically; release ownership and registry permissions remain manual gates.
