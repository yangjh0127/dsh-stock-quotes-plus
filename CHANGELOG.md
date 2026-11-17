# Changelog

All notable changes to this project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [3.0.3] - 2026-11-17

- Remove the right-side divider from each item in the top quotes ticker.

## [3.0.2] - 2026-11-17

- Support Longbridge device authorization without forwarding a callback port.
- Report which Longbridge login step failed and try the China endpoint when the global endpoint is unreachable and no region is configured.
- Keep pre-open quotes at the left edge of intraday charts and preserve US trading sessions that cross midnight.

## [3.0.1] - 2026-11-16

- Add Longbridge OAuth sign-in to the plugin settings and Data toolbar.
- Fix intraday chart loading and expand search across US, Hong Kong, Shanghai, Shenzhen, STAR Market, and Beijing Exchange securities.
- Show security names and a 1px top border in the ticker, and show an intraday chart in the quote popup.

## [3.0.0]

- Use Longbridge OpenAPI with OAuth 2.0 for quotes, charts and the agent tool.
- Support existing stock-code spellings and saved watchlists.
