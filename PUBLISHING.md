# Publishing Checklist

Use this checklist before the first npm publish.

## Required decisions

These are the only items still best decided by the maintainer:

- Set the GitHub repository URL in `package.json` once the public repo exists.
- Decide whether to keep the unscoped name `influx-vue` or publish under a scope such as `@your-scope/influx-vue`.

## Current package readiness

- Library build emits JavaScript bundles and declaration files into `dist/`.
- `npm pack --dry-run` is part of the release check.
- Public assets from the demo app are excluded from the published tarball.
- CSS is exported as `influx-vue/style.css`.
- The package is no longer marked `private`.
- The project license is `Apache-2.0`.

## Release steps

1. Log into npm with `npm login`.
2. Run `pnpm release:check`.
3. Inspect the generated tarball with `npm pack --json` if you want to confirm contents manually.
4. Publish with `npm publish`.

## Recommended follow-up

- Add a GitHub Actions workflow for release checks on tags.
- Add repository metadata (`repository`, `homepage`, `bugs`) after the public GitHub URL is known.
- Add a changelog strategy before the first stable release.
