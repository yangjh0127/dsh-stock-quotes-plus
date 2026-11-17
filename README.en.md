# dsh-stock-quotes-plus

[中文](README.md) · English

A DeepSeek Harness plugin for watchlist quotes and intraday charts from Longbridge OpenAPI. The `stock_quote` tool brings the same quote source into conversations.

## Features

- **Data panel** — search by name or symbol, manage the watchlist and select a row to see the latest session or the last five trading sessions.
- **Top ticker** — visible by default and configurable from the Data toolbar. It scrolls security names, prices and price changes. Select a name to open a quote detail card with an intraday chart. The panel and ticker share a watchlist and refresh interval.
- **Agent quotes** — `stock_quote` supports batches. Without arguments it uses the tool's default symbols configured in the DSH profile.

Charts and ticker details overlay volume bars behind the price line. Historical bars use Longbridge data, and live volume is estimated from changes in reported cumulative volume.

## Install and sign in

Requires DeepSeek Harness 0.2.x, Node.js 20 or later, and an OpenAPI-enabled Longbridge account with quote access.

```bash
git clone https://github.com/yangjh0127/dsh-stock-quotes-plus.git
```

Install the cloned directory in a DSH session:

```
plugin_manager action: install_bundle target: <absolute-path-to-checkout>
```

1. Open **Data** in the DSH sidebar and select **Sign in to Longbridge**. The same button is available in the plugin settings.
2. Complete OAuth 2.0 authorization on the official Longbridge page. If the popup is blocked, select **Open Longbridge authorization**. If Longbridge asks for a device code, enter the code shown in the DSH panel.
3. Return to DSH. The panel refreshes automatically. The SDK stores and refreshes tokens on the DSH host.

Device authorization works in a browser on any device, without a port forward. Older clients that do not support device authorization fall back to `http://localhost:60355/callback`. For that flow, use a browser on the DSH host or forward the callback port over SSH.

## Symbol examples

| Market | Name or symbol |
| --- | --- |
| US | Apple `AAPL.US`, Nasdaq Composite `.IXIC.US` |
| Hong Kong | Tencent `700.HK` |
| Shanghai | SSE Composite `000001.SH`, Kweichow Moutai `600519.SH` |
| Shenzhen | SZSE Component `399001.SZ`, CATL `300750.SZ` |
| STAR Market | SMIC `688981.SH` |
| Beijing Exchange | `920799.BJ` |

The bundled index makes Beijing Exchange symbols searchable. The panel shows when Longbridge has no quote for a symbol. Quote delays depend on [OpenAPI market data permissions](https://open.longbridge.com/docs/quote/overview).

The DSH host reuses the last quote and intraday series while each market is closed and resumes fetching at the next trading session. This includes the Hong Kong and mainland lunch breaks. Startup seeds the intraday chart once for each watchlist symbol, then updates minute points from existing quote requests. Missed minutes do not trigger a backfill request. The five-session chart loads on demand and reuses its snapshot while the market is closed.

## Updates and licensing

Update the checkout, reinstall the plugin and refresh DSH. See the [changelog](CHANGELOG.md).

MIT · [LICENSE](LICENSE) · [Ticker component license](LICENSE-ticker)
