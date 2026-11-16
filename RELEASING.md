# Releasing dsh-stock-quotes-plus

1. Update the version in `package.json` and `package-lock.json` and add a matching heading in `CHANGELOG.md`.
2. Run `npm test`, `npm run lint`, `npm run check:release` and `npm pack --dry-run`.
3. Push the version commit. To publish, create a matching `vX.Y.Z` tag only after the registry publishing credentials are configured.

The release workflow publishes to npm and creates the GitHub release. Configure npm trusted publishing for `yangjh0127/dsh-stock-quotes-plus` and `release.yml`, or set the repository's `NPM_TOKEN` secret.
