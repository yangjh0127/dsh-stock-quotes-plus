# Contributing

Use Node.js 20 or later and install the project dependencies with `npm ci`.

```bash
npm test
npm run lint
npm run check:release
npm pack --dry-run
```

`client.js` registers the DSH panel, plugin settings and ticker. `index.js` registers the agent tool and the host routes. `quotes.js` translates Longbridge results for both consumers, and `oauth.js` handles authorization.

The automated tests use fixtures for market data and OAuth. When testing actual quotes or sign-in, follow the [README](README.md) and use a separate DSH profile. Keep access tokens and account details out of issues and pull requests.

Report security issues using the [security policy](SECURITY.md).
