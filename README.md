# dsh-stock-quotes-plus

中文 · [English](README.en.md)

DeepSeek Harness 行情插件。通过长桥 OpenAPI 查看自选股报价和分钟走势，也可以在对话里用 `stock_quote` 查价。

## 功能

- **侧栏数据面板**：按名称或代码搜索，添加自选股，拖动排序或批量管理。点一行可看当日分时和最近 5 个交易日走势。
- **顶部行情条**：默认显示，可在「数据」工具栏关闭。滚动显示证券名称、价格和涨跌幅。点击名称查看行情详情和当日分时。行情条与侧栏共用自选股与刷新设置。
- **对话查价**：`stock_quote` 支持批量查询。未指定代码时使用 DSH profile 中为工具配置的默认自选股。

## 安装和登录

需要 DeepSeek Harness 0.2.x、Node.js 20 或更新版本，以及已开通 OpenAPI 行情权限的长桥账号。

```bash
git clone https://github.com/yangjh0127/dsh-stock-quotes-plus.git
```

在 DSH 会话中用 `plugin_manager` 的 `install_bundle` 操作安装克隆目录：

```
plugin_manager action: install_bundle target: <仓库的绝对路径>
```

1. 在 DSH 侧栏打开「数据」，点击「登录长桥」。也可从「插件 → 数据面板 → 面板设置」登录。
2. 在长桥官方页面完成 OAuth 2.0 授权。若浏览器拦截了弹窗，点击「打开长桥授权页」。
3. 回到 DSH。授权成功后面板会自动刷新。长桥 SDK 在 DSH 宿主端保存和刷新令牌。

本机授权使用 `http://localhost:60355/callback`。远程部署可转发这个回调端口，也可用同一个系统用户在宿主机执行 `npm ci` 和 `npm run authorize -- 你的ClientID`，并为 DSH 配置 `LONGBRIDGE_CLIENT_ID`。

## 搜索示例

| 市场 | 名称或代码 |
| --- | --- |
| 美股 | 苹果 `AAPL.US`、纳斯达克综合指数 `.IXIC.US` |
| 港股 | 腾讯控股 `700.HK` |
| 沪市 | 上证指数 `000001.SH`、贵州茅台 `600519.SH` |
| 深市 | 深证成指 `399001.SZ`、宁德时代 `300750.SZ` |
| 科创板 | 中芯国际 `688981.SH` |
| 北交所 | 艾融软件 `920799.BJ` |

北交所标的可从随插件附带的索引搜索。长桥未返回报价时，面板会显示「暂无长桥报价」。各市场的实时性取决于账号的 [OpenAPI 行情权限](https://open.longbridge.com/zh-CN/docs/quote/overview)。

休市时，DSH 宿主会复用各市场的最后一份报价和分时数据，进入下一交易时段后恢复刷新。港股和 A 股的午休也适用。启动时为全部自选股补取一次当日分时，之后复用报价更新分钟点。错过的分钟不会另发请求补齐。近 5 日走势只在点开时加载，休市期间复用快照。

## 更新与许可证

更新工作副本后重新安装插件并刷新 DSH。变更记录见 [CHANGELOG.md](CHANGELOG.md)。

MIT · [LICENSE](LICENSE) · [行情条组件许可证](LICENSE-ticker)
