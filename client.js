/**
 * dsh-stock-quotes — Client half (Web UI).
 *
 * Two registrations, both root-scoped:
 *   - the行情 page in the layout's `main` keyed slot under the key `stock-quotes`;
 *   - its sidebar icon in `sidebar.panellist`, whose id addresses that same key.
 *
 * The page reads quotes straight from the public Eastmoney endpoint: it is JSON,
 * key-free and CORS-permissive, so no Host plumbing is needed for the visual half.
 * The symbol rules and quote shape mirror the Host half's `quotes.js`.
 */
window.__ModuleLoader__.load({
  id: 'dsh-stock-quotes-plus',
  factory(require) {
    const React = require('react');
    const h = React.createElement;

    const NS = 'stock-quotes';
    const PANEL_ID = 'stock-quotes';
    /** Must equal package.json `name`: it keys the bundle's own settings card. */
    const PKG = 'dsh-stock-quotes-plus';
    const STORAGE_KEY = 'dsh-stock-quotes/watchlist';
    const CHART_TTL = 60000;
    /** At most this many intraday requests in flight at once. */
    const TREND_CONCURRENCY = 4;
    const DEFAULT_SYMBOLS = ['sh000001', 'sh600519', 'sz300750', 'hk00700', 'usAAPL'];

    const BATCH_ENDPOINT = 'https://push2.eastmoney.com/api/qt/ulist.np/get';
    const BATCH_FIELDS = 'f12,f13,f14,f2,f3,f4,f5,f6,f15,f16,f17,f18';
    const US_MARKETS = [105, 106, 107];

    const FALLBACK_TEXT = {
      'panel.defaultLabel': '数据',
      'panel.auto': '自动刷新',
      'panel.refresh': '刷新',
      'panel.add': '添加',
      'panel.placeholder': '代码或板块名，如 600519、半导体、00700',
      'panel.empty': '自选股为空。在上面输入代码或板块名后回车即可添加。',
      'panel.notFound': '未找到该代码或板块',
      'panel.resolving': '查询板块…',
      'panel.thsBoardCode': '同花顺板块码无法直接使用，请输入板块名称（如 半导体）或东财代码 BK1036',
      'panel.loading': '加载中…',
      'panel.error': '行情获取失败',
      'panel.retry': '重试',
      'panel.unresolved': '未找到',
      'panel.convention': '红涨绿跌',
      'panel.source': '数据源：东方财富',
      'panel.drag': '拖动排序',
      'panel.chart': '曲线',
      'panel.alert': '异动提醒 超过',
      'panel.sortedHint': '已按列排序；要拖动排序请先取消排序',
      'focus.high': '最高',
      'focus.low': '最低',
      'focus.preClose': '昨收',
      'focus.avg': '均价',
      'focus.vol': '量',
      'focus.days1': '1日',
      'focus.days5': '5日',
      'focus.close': '关闭',
      'focus.hint': '在图上移动鼠标查看具体数值',
      'panel.copied': '已复制代码',
      'panel.copyFailed': '复制失败',
      'menu.title': '关注项操作',
      'menu.remove': '删除',
      'menu.copy': '复制代码',
      'menu.moveTop': '置顶',
      'menu.moveUp': '上移',
      'menu.moveDown': '下移',
      'menu.moveBottom': '置底',
      'menu.selectAll': '全选',
      'menu.clearSelection': '清除选择',
      'menu.select': '选中',
      'batch.selected': '已选',
      'batch.remove': '删除所选',
      'batch.top': '置顶',
      'batch.bottom': '置底',
      'batch.clear': '取消选择',
      'col.name': '名称 / 代码',
      'col.trend': '走势',
      'col.price': '最新价',
      'col.change': '涨跌额',
      'col.pct': '涨跌幅',
      'col.open': '今开',
      'col.high': '最高',
      'col.low': '最低',
      'col.amount': '成交额',
      'settings.title': '显示名称',
      'settings.cardTitle': '面板设置',
      'settings.cardDesc': '修改侧边栏图标与面板显示的名称；留空则用默认名称。',
      'settings.name': '名称',
      'settings.namePlaceholder': '留空则用默认名称',
      'settings.nameHint': '建议用不指向具体内容的中性名称，例如「数据」「报表」「Records」。',
      'settings.ticker': '显示顶部行情条',
      'settings.refresh': '刷新间隔',
      'settings.convention': '涨跌配色',
      'settings.conventionCn': '红涨绿跌（A 股习惯）',
      'settings.conventionIntl': '绿涨红跌（国际习惯）',
      'settings.columns': '显示的列',
      'settings.alert': '异动提醒阈值 (%)',
      'settings.alertHint': '当日涨跌幅绝对值超过该值时面板顶部提示；0 表示关闭。',
      'settings.watchlist': '自选股导入 / 导出',
      'settings.export': '导出到下方文本框',
      'settings.import': '从下方文本框导入',
      'settings.exported': '已导出，可复制保存',
      'settings.imported': '已导入',
      'settings.importFailed': '导入失败：需要 {"symbols": [...]} 或字符串数组',
      'settings.transferPlaceholder': '{"version":1,"symbols":["sh600519","hk00700"]}',
      'settings.save': '保存',
      'settings.reset': '恢复默认',
      'settings.saved': '已保存',
      'settings.effective': '当前生效',
    };

    const CSS = `
.dsq-root{box-sizing:border-box;width:100%;min-width:0;height:100%;min-height:0;display:flex;flex-direction:column;overflow:hidden;font-size:13px;color:var(--dsw-alias-label-primary);background:var(--dsw-alias-bg-base)}
.dsq-scroll{flex:1 1 auto;min-height:0;overflow-y:auto;scrollbar-gutter:stable}
.dsq-inner{padding:28px clamp(16px,3vw,40px) 48px}
[data-platform=darwin] .dsq-inner{padding-top:calc(28px + var(--dsh-frame-top-clearance,0px))}
.dsq-head{display:flex;align-items:center;flex-wrap:wrap;gap:8px;margin:0 0 4px}
.dsq-title{margin:0;font-size:20px;font-weight:500;line-height:28px}
.dsq-meta{color:var(--dsw-alias-label-secondary);font-size:12px;line-height:18px}
.dsq-grow{flex:1 1 auto}
.dsq-toolbar{display:flex;align-items:center;gap:8px;margin:12px 0 16px;flex-wrap:wrap}
.dsq-btn{box-sizing:border-box;border:1px solid var(--dsw-alias-border-l2);background:var(--dsw-alias-bg-layer-2);color:var(--dsw-alias-label-secondary);font:inherit;font-size:12px;line-height:18px;padding:3px 12px;border-radius:999px;cursor:pointer;white-space:nowrap;transition:border-color .2s,color .2s}
.dsq-btn:hover{border-color:var(--dsw-alias-label-secondary);color:var(--dsw-alias-label-primary)}
.dsq-btn[aria-checked=true]{border-color:var(--dsw-alias-brand-primary);color:var(--dsw-alias-brand-primary)}
.dsq-form{position:relative;display:flex;align-items:center;gap:8px;flex:0 1 340px;min-width:220px}
.dsq-input{box-sizing:border-box;flex:1 1 auto;min-width:0;border:1px solid var(--dsw-alias-border-l2);background:var(--dsw-alias-bg-layer-2);color:var(--dsw-alias-label-primary);font:inherit;font-size:13px;line-height:20px;padding:5px 10px;border-radius:8px}
.dsq-input::placeholder{color:var(--dsw-alias-label-secondary)}
.dsq-input:focus{outline:none;border-color:var(--dsw-alias-brand-primary)}
.dsq-suggest{position:absolute;top:calc(100% + 4px);left:0;z-index:40;display:flex;flex-direction:column;gap:2px;min-width:100%;max-width:360px;padding:4px;border:1px solid var(--dsw-alias-border-l1);border-radius:8px;background:var(--dsw-alias-bg-overlay);box-shadow:0 10px 28px rgb(0 0 0 / 0.3)}
.dsq-suggest-item{display:flex;align-items:baseline;justify-content:space-between;gap:12px;padding:5px 8px;border:0;border-radius:6px;background:transparent;color:var(--dsw-alias-label-primary);font:inherit;font-size:12px;line-height:18px;text-align:left;cursor:pointer}
.dsq-suggest-item:hover,.dsq-suggest-item:focus-visible{background:var(--dsw-alias-bg-layer-2);outline:none}
.dsq-suggest-code{color:var(--dsw-alias-label-secondary);font-variant-numeric:tabular-nums}
.dsq-tablewrap{border:1px solid var(--dsw-alias-border-l1);border-radius:12px;background:var(--dsw-alias-bg-layer-1);overflow-x:auto}
.dsq-grid{min-width:var(--dsq-min-width,820px)}
.dsq-row{display:grid;grid-template-columns:28px 20px minmax(150px,1.6fr) repeat(4,minmax(72px,.9fr)) repeat(3,minmax(64px,.8fr));align-items:center;gap:8px;padding:6px 14px 6px 10px;border-top:1px solid var(--dsw-alias-border-l1)}
.dsq-row:focus-visible{outline:2px solid var(--dsw-alias-brand-primary);outline-offset:-2px}
.dsq-sorth{border:0;background:transparent;color:inherit;font:inherit;font-size:12px;line-height:18px;padding:0;text-align:right;cursor:pointer}
.dsq-sorth:hover,.dsq-sorth:focus-visible{color:var(--dsw-alias-brand-primary);outline:none}
.dsq-alert{margin:0 0 10px;padding:6px 10px;border:1px solid var(--dsw-alias-state-warn-primary);border-radius:8px;color:var(--dsw-alias-state-warn-primary);font-size:12px;line-height:18px}
.dsq-root[data-convention="intl"] .dsq-up{color:var(--dsw-alias-state-success-primary)}
.dsq-root[data-convention="intl"] .dsq-down{color:var(--dsw-alias-state-error-primary)}
.dsq-chart{display:flex;align-items:center;justify-content:center;min-width:0}
.dsq-chart svg{display:block;width:100%;height:24px}
.dsq-btn[aria-pressed=true]{border-color:var(--dsw-alias-brand-primary);color:var(--dsw-alias-brand-primary)}
.dsq-focus{position:relative;margin:0 0 14px;padding:10px 12px 8px;border:1px solid var(--dsw-alias-border-l1);border-radius:12px;background:var(--dsw-alias-bg-layer-1)}
.dsq-focus-head{display:flex;align-items:center;gap:10px;flex-wrap:wrap;margin-bottom:6px;font-size:12px;line-height:18px}
.dsq-focus-title{font-size:13px;color:var(--dsw-alias-label-primary)}
.dsq-focus-code{margin-left:6px;color:var(--dsw-alias-label-secondary);font-size:12px;font-variant-numeric:tabular-nums}
.dsq-focus-price{font-variant-numeric:tabular-nums}
.dsq-focus-extra{color:var(--dsw-alias-label-secondary);font-variant-numeric:tabular-nums}
.dsq-focus svg{display:block;width:100%;height:auto;cursor:crosshair}
.dsq-focus-empty{color:var(--dsw-alias-label-secondary);font-size:12px;line-height:32px}
.dsq-focus-cursor{min-height:18px;margin-top:2px;color:var(--dsw-alias-label-secondary);font-size:12px;line-height:18px;font-variant-numeric:tabular-nums}
.dsq-row.dsq-focused{background:var(--dsw-alias-bg-layer-2);box-shadow:inset 2px 0 0 var(--dsw-alias-brand-primary)}
.dsq-row:first-child{border-top:none}
.dsq-row:not(.dsq-headrow):hover{background:var(--dsw-alias-bg-layer-2)}
.dsq-headrow{background:var(--dsw-alias-bg-layer-2);color:var(--dsw-alias-label-secondary);font-size:12px;line-height:18px}
.dsq-num{text-align:right;font-variant-numeric:tabular-nums}
.dsq-up{color:var(--dsw-alias-state-error-primary)}
.dsq-down{color:var(--dsw-alias-state-success-primary)}
.dsq-flat{color:var(--dsw-alias-label-primary)}
.dsq-id{display:flex;flex-direction:column;min-width:0}
.dsq-name{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.dsq-code{color:var(--dsw-alias-label-secondary);font-size:12px;line-height:16px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.dsq-missing{color:var(--dsw-alias-label-secondary)}
.dsq-selected{background:var(--dsw-alias-bg-layer-2)}
.dsq-dragging{opacity:.45}
.dsq-drop-before{box-shadow:inset 0 2px 0 var(--dsw-alias-brand-primary)}
.dsq-drop-after{box-shadow:inset 0 -2px 0 var(--dsw-alias-brand-primary)}
.dsq-pick{display:flex;align-items:center;justify-content:center}
.dsq-pick input{width:14px;height:14px;margin:0;cursor:pointer;accent-color:var(--dsw-alias-brand-primary)}
.dsq-grip-cell{display:flex;align-items:center;justify-content:center}
.dsq-grip{color:var(--dsw-alias-label-secondary);cursor:grab;font-size:12px;line-height:1;padding:2px;user-select:none}
.dsq-grip:active{cursor:grabbing}
.dsq-selbar{display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin:0 0 12px;padding:8px 12px;border:1px solid var(--dsw-alias-border-l2);border-radius:10px;background:var(--dsw-alias-bg-layer-2)}
.dsq-selcount{color:var(--dsw-alias-label-secondary);font-size:12px;line-height:18px}
.dsq-notice{color:var(--dsw-alias-state-success-primary);font-size:12px;line-height:18px}
.dsq-menu{position:fixed;z-index:40;box-sizing:border-box;padding:4px;border:1px solid var(--dsw-alias-border-l2);border-radius:10px;background:var(--dsw-alias-bg-overlay);overflow-y:auto;max-height:70vh}
.dsq-menu:focus{outline:none}
.dsq-menu-item{display:block;box-sizing:border-box;width:100%;border:none;background:transparent;color:var(--dsw-alias-label-primary);font:inherit;font-size:13px;line-height:20px;text-align:left;padding:6px 10px;border-radius:6px;cursor:pointer;white-space:nowrap}
.dsq-menu-item:hover:not(:disabled){background:var(--dsw-alias-bg-layer-2)}
.dsq-menu-item:disabled{color:var(--dsw-alias-state-idle-primary);cursor:default}
.dsq-menu-sep{height:1px;margin:4px 6px;background:var(--dsw-alias-border-l1)}
.dsq-empty{border:1px dashed var(--dsw-alias-border-l2);border-radius:12px;padding:32px 20px;text-align:center;color:var(--dsw-alias-label-secondary);line-height:20px}
.dsq-note{margin-top:12px;color:var(--dsw-alias-label-secondary);font-size:12px;line-height:18px}
.dsq-error{margin:12px 0 0;color:var(--dsw-alias-state-error-primary);font-size:12px;line-height:18px}
.dsq-prefs-row{display:flex;align-items:flex-start;gap:16px;padding:14px 0;border-top:1px solid var(--dsw-alias-border-l1)}
.dsq-prefs-row:first-of-type{border-top:none}
.dsq-prefs-key{flex:0 0 120px;padding-top:5px;color:var(--dsw-alias-label-secondary)}
.dsq-prefs-field{display:flex;flex-direction:column;gap:6px;flex:1 1 auto;min-width:0}
.dsq-prefs-input{box-sizing:border-box;width:100%;max-width:320px;border:1px solid var(--dsw-alias-border-l2);background:var(--dsw-alias-bg-layer-2);color:var(--dsw-alias-label-primary);font:inherit;font-size:13px;line-height:20px;padding:5px 10px;border-radius:8px}
.dsq-prefs-input::placeholder{color:var(--dsw-alias-label-secondary)}
.dsq-prefs-input:focus{outline:none;border-color:var(--dsw-alias-brand-primary)}
.dsq-prefs-hint{color:var(--dsw-alias-label-secondary);font-size:12px;line-height:18px}
.dsq-prefs-actions{display:flex;align-items:center;gap:8px;padding-top:16px}
.dsq-prefs-saved{color:var(--dsw-alias-state-success-primary);font-size:12px;line-height:18px}
.dsq-card{box-sizing:border-box;border:1px solid var(--dsw-alias-border-l1);background:var(--dsw-alias-bg-layer-1);border-radius:12px;padding:16px 18px;margin:16px 0;color:var(--dsw-alias-label-primary);font-size:13px}
.dsq-card-title{margin:0 0 6px;font-size:14px;font-weight:500;line-height:22px}
.dsq-card-desc{margin:0 0 4px;color:var(--dsw-alias-label-secondary);font-size:12px;line-height:18px}
`;

    /** Pad a Hong Kong code to five digits. */
    function hkCode(body) {
      const digits = body.replace(/^0+/, '');
      return digits === '' ? '00000' : digits.padStart(5, '0');
    }

    /** Secids for one market: 1 = Shanghai, 0 = Shenzhen/Beijing, 116 = HK, 105-107 = US. */
    function secidsForMarket(market, body) {
      if (market === 'sh') return [`1.${body}`];
      if (market === 'sz' || market === 'bj') return [`0.${body}`];
      if (market === 'hk') return [`116.${hkCode(body)}`];
      if (market === 'us') return US_MARKETS.map((secidMarket) => `${secidMarket}.${body}`);
      return [];
    }

    /** Exchange suffixes seen in exports from 同花顺 / 通达信 / Yahoo. */
    const SUFFIX_MARKETS = {
      SH: 'sh', SS: 'sh', SZ: 'sz', BJ: 'bj', HK: 'hk', US: 'us', O: 'us', N: 'us', A: 'us',
    };

    /**
     * Expand one spelling into the secids worth trying, best first. Mirrors
     * `quotes.js`: prefix and suffix notation, Hong Kong and US codes, and both
     * markets for an ambiguous bare six-digit A-share code.
     */
    function candidateSecids(input) {
      if (typeof input !== 'string') return [];
      const raw = input.trim();
      if (raw === '') return [];

      const suffixed = /^([^.-]+)[.-]([A-Za-z]{1,2})$/.exec(raw);
      if (suffixed !== null) {
        const market = SUFFIX_MARKETS[suffixed[2].toUpperCase()];
        const suffixedBody = suffixed[1].trim().toUpperCase();
        if (market !== undefined && suffixedBody !== '') return secidsForMarket(market, suffixedBody);
      }

      if (/^\d{1,3}\.[A-Za-z0-9._-]+$/.test(raw)) return [raw];

      const prefixed = /^(sh|sz|bj|hk|us|nasdaq|nyse)[.:_-]?(.+)$/i.exec(raw);
      const prefix = prefixed === null ? '' : prefixed[1].toLowerCase();
      const body = (prefixed === null ? raw : prefixed[2]).trim().toUpperCase();
      if (body === '') return [];

      if (prefix === 'nasdaq' || prefix === 'nyse') return secidsForMarket('us', body);
      if (prefix !== '') return secidsForMarket(prefix, body);

      if (/^\d{6}$/.test(body)) {
        const primary = /^92\d{4}$/.test(body) ? 'sz' : (/^[569]/.test(body) ? 'sh' : 'sz');
        const secondary = primary === 'sh' ? 'sz' : 'sh';
        return [...secidsForMarket(primary, body), ...secidsForMarket(secondary, body)];
      }
      if (/^\d{1,5}$/.test(body)) return secidsForMarket('hk', body);
      // Eastmoney boards (板块) live on market 90: `BK1036` is the 半导体 board.
      if (/^BK\d+$/.test(body)) return [`90.${body}`];
      if (/^[A-Z][A-Z0-9.-]*$/.test(body)) return secidsForMarket('us', body);
      return [];
    }

    /**
     * Board (板块) names resolve against Eastmoney's own index, which this page can
     * read directly. The index is ~1000 rows across ten pages, so it is fetched on
     * demand and cached for a while instead of on every keystroke.
     */
    const BOARD_FAMILIES = ['m:90+t:2+f:!50', 'm:90+t:3+f:!50'];
    const BOARD_TTL = 10 * 60 * 1000;
    let boardIndex = null;
    let boardIndexAt = 0;

    /** Eastmoney appends Ⅱ/Ⅲ to split boards, so ignore that suffix when matching. */
    function boardNameKey(name) {
      return String(name).trim().replace(/[/\u2161-\u2163]$/, '');
    }

    async function fetchBoardIndex() {
      if (boardIndex !== null && Date.now() - boardIndexAt < BOARD_TTL) return boardIndex;
      const rows = [];
      for (const family of BOARD_FAMILIES) {
        for (let page = 1; page <= 6; page += 1) {
          const url = 'https://push2.eastmoney.com/api/qt/clist/get'
            + `?pn=${page}&pz=100&po=1&np=1&fltt=2&invt=2&fid=f3&fs=${family}&fields=f12,f14`;
          // A missing page should narrow the index, not fail the whole lookup, so
          // a page that errors twice is skipped rather than thrown.
          let chunk = null;
          for (let attempt = 0; attempt < 2 && chunk === null; attempt += 1) {
            try {
              const response = await fetch(url, { signal: AbortSignal.timeout(15000) });
              if (!response.ok) break;
              const payload = await response.json();
              chunk = payload?.data?.diff ?? [];
            } catch {
              // Leave the page missing; the loop retries once and then moves on.
            }
          }
          if (chunk === null || chunk.length === 0) break;
          rows.push(...chunk);
        }
      }
      const index = new Map();
      for (const row of rows) {
        const name = boardNameKey(row.f14);
        const code = String(row.f12 ?? '');
        if (name !== '' && code !== '' && !index.has(name)) index.set(name, code);
      }
      boardIndex = index;
      boardIndexAt = Date.now();
      return index;
    }

    /**
     * Resolve a board name to its Eastmoney code.
     * @param query - what the user typed, e.g. `半导体`.
     * @returns The `BKxxxx` code, or an empty string when there is no unique match.
     */
    async function resolveBoard(query) {
      const wanted = boardNameKey(query);
      if (wanted.length < 2) return '';
      const index = await fetchBoardIndex();
      if (index.has(wanted)) return index.get(wanted);
      const hits = [...index.entries()].filter(([name]) => name.includes(wanted) || wanted.includes(name));
      return hits.length === 1 ? hits[0][1] : '';
    }

    /**
     * Name search. No public search endpoint sends a CORS header, so the searchable
     * list is generated by `scripts/build-index.mjs`, committed to the repository and
     * served from a CDN: one request, cached in localStorage for a day.
     *
     * The CDN URLs are pinned to this release, not to `main`, so the bytes the panel
     * searches are the bytes that shipped with this version: the npm tarball first
     * (the plugin is distributed through the registry), then the git release tag, then
     * raw `main` as a fallback for a development checkout whose version is not
     * published yet. `tests/meta.test.mjs` keeps INDEX_VERSION equal to package.json.
     */
    const INDEX_VERSION = '2.0.2';
    const INDEX_URLS = [
      `https://cdn.jsdelivr.net/npm/dsh-stock-quotes@${INDEX_VERSION}/data/securities.json`,
      `https://cdn.jsdelivr.net/gh/AhaCrazy/dsh-stock-quotes@v${INDEX_VERSION}/data/securities.json`,
      'https://raw.githubusercontent.com/AhaCrazy/dsh-stock-quotes/main/data/securities.json',
    ];
    const INDEX_KEY = 'dsh-stock-quotes/index';
    const INDEX_TTL = 24 * 60 * 60 * 1000;
    let indexPromise = null;

    function readIndexCache() {
      try {
        const raw = window.localStorage.getItem(INDEX_KEY);
        if (raw === null) return null;
        const parsed = JSON.parse(raw);
        return Array.isArray(parsed?.entries) && parsed.entries.length > 0 ? parsed : null;
      } catch {
        return null;
      }
    }

    function writeIndexCache(entries) {
      try {
        window.localStorage.setItem(INDEX_KEY, JSON.stringify({ at: Date.now(), entries }));
      } catch {
        // Quota or private mode: the index just stays in memory for this page.
      }
    }

    async function loadIndex() {
      if (indexPromise !== null) return indexPromise;
      indexPromise = (async () => {
        const cached = readIndexCache();
        if (cached !== null && Date.now() - (cached.at ?? 0) < INDEX_TTL) return cached;
        for (const url of INDEX_URLS) {
          try {
            const response = await fetch(url, { signal: AbortSignal.timeout(15000) });
            if (!response.ok) continue;
            const payload = await response.json();
            if (Array.isArray(payload?.entries) && payload.entries.length > 0) {
              writeIndexCache(payload.entries);
              return { at: Date.now(), entries: payload.entries };
            }
          } catch {
            // Try the next host, then fall back to whatever is cached.
          }
        }
        return cached ?? { at: 0, entries: [] };
      })();
      return indexPromise;
    }

    /**
     * Rank index entries for a typed query: exact name, name prefix, name substring,
     * then code prefix. Stable and dependency-free — the list is ~11k rows.
     */
    function searchIndex(entries, query, limit = 8) {
      const text = String(query ?? '').trim().toLowerCase();
      if (text === '' || !Array.isArray(entries)) return [];
      const scored = [];
      for (const entry of entries) {
        if (!Array.isArray(entry) || entry.length < 2) continue;
        const name = String(entry[0]);
        const spelling = String(entry[1]);
        const lowerName = name.toLowerCase();
        let score = -1;
        if (lowerName === text) score = 0;
        else if (lowerName.startsWith(text)) score = 1;
        else if (lowerName.includes(text)) score = 2;
        else if (spelling.toLowerCase().startsWith(text)) score = 3;
        if (score >= 0) scored.push([score, name, spelling]);
      }
      scored.sort((left, right) => left[0] - right[0] || left[1].localeCompare(right[1], 'zh-Hans-CN'));
      return scored.slice(0, limit).map(([, name, spelling]) => [name, spelling]);
    }

    const TREND_ENDPOINT = 'https://push2his.eastmoney.com/api/qt/stock/trends2/get';

    /**
     * Intraday close series for one entry, trying each candidate market the
     * spelling allows. `close` is what the sparkline draws; `average` and `volume`
     * are what the focus chart reads out.
     * @param input - a watchlist spelling.
     * @param signal - optional abort signal.
     * @param days - 1 for today, 5 for the last five sessions.
     * @returns `{ day, t, v, vol, avg }` rows in chronological order; empty when
     *   nothing answers.
     */
    async function fetchTrend(input, signal, days = 1) {
      for (const secid of candidateSecids(input)) {
        try {
          const url = `${TREND_ENDPOINT}?secid=${encodeURIComponent(secid)}`
            + `&fields1=f1,f2&fields2=f51,f53,f56,f58&ndays=${days}&iscr=0&iscca=0&_=${Date.now()}`;
          const response = await fetch(url, { signal, cache: 'no-store', headers: { accept: 'application/json' } });
          if (!response.ok) continue;
          const payload = await response.json();
          const rows = payload !== null && payload !== undefined && payload.data
            ? payload.data.trends
            : undefined;
          if (!Array.isArray(rows) || rows.length === 0) continue;
          const points = [];
          for (const row of rows) {
            const parts = String(row).split(',');
            const stamp = String(parts[0]).trim();
            const value = Number(parts[1]);
            if (!Number.isFinite(value)) continue;
            const volume = Number(parts[2]);
            const average = Number(parts[3]);
            points.push({
              day: stamp.slice(0, 10),
              t: stamp.slice(-5),
              v: value,
              vol: Number.isFinite(volume) ? volume : undefined,
              avg: Number.isFinite(average) ? average : undefined,
            });
          }
          if (points.length >= 2) return points;
        } catch (error) {
          if (error !== null && typeof error === 'object' && error.name === 'AbortError') throw error;
        }
      }
      return [];
    }

    /**
     * Trading sessions as *durations*, on the Beijing clock the endpoint stamps
     * every market with. The open is never hardcoded: it is read from the series'
     * first point, so the US session follows the exchange's daylight saving instead
     * of being an hour off half the year. `total` is what the chart is scaled
     * against, so a half-finished day fills half the box. Breaks are relative to
     * the open (minutes elapsed).
     */
    const SESSIONS = {
      cn: { total: 240, breaks: [[120, 210]], opens: [570] },
      hk: { total: 330, breaks: [[150, 210]], opens: [570] },
      us: { total: 390, breaks: [], opens: [1290, 1350] },
    };

    /** Tick offsets (minutes elapsed) per session. */
    const SESSION_TICKS = {
      cn: [0, 60, 120, 180, 240],
      hk: [0, 90, 150, 240, 330],
      us: [0, 150, 390],
    };

    /**
     * Run `worker` over `items` with at most `limit` in flight. A watchlist can be
     * long and each entry needs its own history request, so an unbounded
     * `Promise.all` would fire one burst per refresh.
     */
    async function mapLimit(items, limit, worker) {
      const list = Array.isArray(items) ? items : [];
      const results = new Array(list.length);
      // A bad limit must not silently turn into "never run": fall back to a small
      // positive width so the work still happens.
      const wanted = Number.isFinite(limit) && limit >= 1 ? Math.floor(limit) : 4;
      const width = Math.max(1, Math.min(wanted, list.length));
      let next = 0;
      const runners = [];
      for (let slot = 0; slot < width; slot += 1) {
        runners.push((async () => {
          while (next < list.length) {
            const index = next;
            next += 1;
            results[index] = await worker(list[index], index);
          }
        })());
      }
      await Promise.all(runners);
      return results;
    }

    /** `HH:MM` -> minutes since midnight; undefined when the stamp is unreadable. */
    function minutesOf(clock) {
      const match = /^(\d{1,2}):(\d{2})$/.exec(String(clock === undefined ? '' : clock).trim());
      if (match === null) return undefined;
      return Number(match[1]) * 60 + Number(match[2]);
    }

    /** Minutes-since-midnight -> `HH:MM`. */
    function clockOfMinutes(minutes) {
      const wrapped = ((Math.round(minutes) % 1440) + 1440) % 1440;
      const hour = Math.floor(wrapped / 60);
      const minute = wrapped % 60;
      return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
    }

    /**
     * Session open in minutes-of-day. The known open nearest to the series' first
     * stamp wins, which is how daylight saving is handled without a calendar: the
     * US opens at 21:30 Beijing in summer and 22:30 in winter, and the data says
     * which. A series that starts mid-session (a halt, or a test fixture) falls back
     * to the canonical open instead of shifting the whole axis.
     */
    function sessionOpen(kind, points) {
      const session = SESSIONS[kind];
      const opens = session === undefined ? [570] : session.opens;
      const first = Array.isArray(points) && points.length > 0 ? minutesOf(points[0].t) : undefined;
      if (first === undefined) return opens[0];
      for (const open of opens) {
        const distance = Math.abs(((first - open + 1440) % 1440));
        if (distance <= 10) return open;
      }
      return opens[0];
    }

    /** Minutes elapsed since the open, lunch break excluded and clamped to the session. */
    function sessionElapsed(kind, minutes, open) {
      const session = SESSIONS[kind];
      const start = typeof open === 'number' && Number.isFinite(open) ? open : (kind === 'us' ? 1290 : 570);
      let delta = minutes - start;
      // A session that crosses midnight (US on the Beijing clock) starts negative.
      if (delta < 0) delta += 1440;
      for (const [from, to] of session.breaks) {
        if (delta >= to) delta -= to - from;
        else if (delta > from) delta = from;
      }
      return Math.max(0, Math.min(delta, session.total));
    }

    /** Session key for one quote's exchange label. */
    function sessionKindOf(market) {
      const label = String(market === undefined || market === null ? '' : market).toUpperCase();
      if (label === 'HK') return 'hk';
      if (label === 'NASDAQ' || label === 'NYSE' || label === 'AMEX') return 'us';
      if (label === 'SH' || label === 'SZ' || label === 'BJ' || label === 'BK') return 'cn';
      return undefined;
    }

    /** Min/max of the finite values in a series. */
    function seriesBounds(series) {
      let min = Infinity;
      let max = -Infinity;
      for (const item of Array.isArray(series) ? series : []) {
        if (item === null || typeof item !== 'object') continue;
        if (typeof item.v !== 'number' || !Number.isFinite(item.v)) continue;
        if (item.v < min) min = item.v;
        if (item.v > max) max = item.v;
      }
      return Number.isFinite(min) && Number.isFinite(max) ? { min, max } : null;
    }

    /** Vertical position of one value in a box of the given height. */
    function seriesY(value, min, max, height) {
      const span = max - min;
      if (span === 0) return height / 2;
      return height - ((value - min) / span) * (height - 2) - 1;
    }

    /**
     * Horizontal position of one series index in the sparkline's box, following the
     * same session rule the path uses.
     */
    function seriesXAt(series, index, kind, width = 88) {
      const list = Array.isArray(series) ? series : [];
      if (list.length < 2) return 0;
      const known = kind !== undefined && Object.prototype.hasOwnProperty.call(SESSIONS, kind);
      if (known) {
        const minutes = minutesOf(list[index] === undefined ? undefined : list[index].t);
        if (minutes !== undefined) {
          return (sessionElapsed(kind, minutes, sessionOpen(kind, list)) / SESSIONS[kind].total) * width;
        }
      }
      return (index / (list.length - 1)) * width;
    }

    /**
     * SVG path for a sparkline.
     *
     * The x axis is the trading session, not the data: a series that stops at 11:30
     * stops half way across, exactly like a terminal. Only when the session is
     * unknown does it fall back to stretching the series across the box.
     *
     * @param series - `{ t, v }` pairs, oldest first.
     * @param options - `{ kind, width, height }`; `kind` is a SESSIONS key.
     * @returns Path data, or an empty string when there is nothing to draw.
     */
    function sparklinePath(series, options) {
      const { kind, width = 88, height = 24 } = options || {};
      const points = [];
      for (const item of Array.isArray(series) ? series : []) {
        if (item === null || typeof item !== 'object') continue;
        if (typeof item.v !== 'number' || !Number.isFinite(item.v)) continue;
        points.push(item);
      }
      const bounds = seriesBounds(points);
      if (points.length < 2 || bounds === null) return '';

      let path = '';
      for (let index = 0; index < points.length; index += 1) {
        const x = seriesXAt(points, index, kind, width);
        const y = seriesY(points[index].v, bounds.min, bounds.max, height);
        path += `${index === 0 ? 'M' : 'L'}${x.toFixed(2)} ${y.toFixed(2)}`;
      }
      return path;
    }

    /** Viewbox the focus chart draws in, with the axis gutters reserved. */
    const FOCUS_BOX = { width: 1000, height: 210, left: 12, right: 76, top: 14, bottom: 30 };
    const FOCUS_PLOT = {
      width: FOCUS_BOX.width - FOCUS_BOX.left - FOCUS_BOX.right,
      height: FOCUS_BOX.height - FOCUS_BOX.top - FOCUS_BOX.bottom,
    };

    /**
     * Wall clock for a number of minutes elapsed in a session: the inverse of
     * `sessionElapsed`, so an axis tick past lunch lands on 14:00, not 12:30.
     */
    function sessionClockFromElapsed(kind, open, elapsed) {
      const session = SESSIONS[kind];
      let wall = elapsed;
      if (session !== undefined) {
        for (const [from, to] of session.breaks) {
          if (elapsed > from) wall += to - from;
        }
      }
      return clockOfMinutes(open + wall);
    }

    /**
     * Axis label for one session offset. A break tick names both sides of the
     * pause (`11:30/13:00`), everything else names the clock at that offset.
     */
    function sessionTickLabel(kind, open, offset) {
      const session = SESSIONS[kind];
      if (session !== undefined) {
        for (const [from, to] of session.breaks) {
          // The break tick names the two wall clocks that share this offset.
          if (from === offset) return `${clockOfMinutes(open + from)}/${clockOfMinutes(open + to)}`;
        }
      }
      return sessionClockFromElapsed(kind, open, offset);
    }

    /** Axis step rounded to the nearest of 1/2/2.5/5 × 10^n, so ticks stay readable. */
    function niceStep(span, count) {
      if (!(span > 0) || !(count > 0)) return 1;
      const rough = span / count;
      const magnitude = Math.pow(10, Math.floor(Math.log10(rough)));
      const normalised = rough / magnitude;
      const factor = normalised <= 1.5 ? 1 : normalised <= 2.25 ? 2 : normalised <= 3.5 ? 2.5 : normalised <= 7.5 ? 5 : 10;
      return factor * magnitude;
    }

    /**
     * Vertical axis ticks inside a plot of the given height.
     * @returns `{ value, y }` rows, top-down.
     */
    function yAxisTicks(min, max, height, count = 4) {
      if (!(max > min) || !(height > 0)) return [];
      const step = niceStep(max - min, count);
      const ticks = [];
      const first = Math.ceil(min / step) * step;
      for (let value = first; value <= max + step * 1e-9; value += step) {
        const y = height - ((value - min) / (max - min)) * height;
        ticks.push({ value, y });
      }
      return ticks;
    }

    /**
     * Horizontal axis labels: the session clock for one day, day starts for five.
     * @returns `{ x, label }` rows in plot units.
     */
    function xAxisTicks(points, kind, mode, width) {
      if (!Array.isArray(points) || points.length < 2) return [];
      if (mode === 1) {
        const total = kind !== undefined && SESSIONS[kind] !== undefined ? SESSIONS[kind].total : undefined;
        const offsets = SESSION_TICKS[kind];
        if (total !== undefined && offsets !== undefined) {
          const open = sessionOpen(kind, points);
          return offsets.map((offset) => ({
            x: (offset / total) * width,
            label: sessionTickLabel(kind, open, offset),
          }));
        }
        const last = points.length - 1;
        return [
          { x: 0, label: points[0].t },
          { x: width, label: points[last].t },
        ];
      }
      const starts = [];
      for (let index = 0; index < points.length; index += 1) {
        const day = points[index].day;
        if (starts.length === 0 || starts[starts.length - 1].day !== day) starts.push({ day, index });
      }
      return starts.map(({ day, index }) => ({
        x: (index / (points.length - 1)) * width,
        label: String(day === undefined ? '' : day).slice(5),
      }));
    }

    /**
     * Index of the point closest to a `0..1` fraction of the plot width — the
     * pointer's position, mapped back through the same x rule the path uses.
     */
    function nearestIndex(points, fraction, kind, mode) {
      if (!Array.isArray(points) || points.length === 0) return -1;
      const clamped = Math.max(0, Math.min(1, Number.isFinite(fraction) ? fraction : 0));
      const total = mode === 1 && kind !== undefined && SESSIONS[kind] !== undefined
        ? SESSIONS[kind].total
        : undefined;
      if (total === undefined) return Math.round(clamped * (points.length - 1));
      const target = clamped * total;
      const open = sessionOpen(kind, points);
      let best = -1;
      let bestDelta = Infinity;
      for (let index = 0; index < points.length; index += 1) {
        const minutes = minutesOf(points[index].t);
        if (minutes === undefined) continue;
        const delta = Math.abs(sessionElapsed(kind, minutes, open) - target);
        if (delta < bestDelta) {
          bestDelta = delta;
          best = index;
        }
      }
      return best;
    }

    /** Hands → `1.20万手` style, for the cursor readout. */
    function formatLots(value) {
      if (typeof value !== 'number' || !Number.isFinite(value)) return '—';
      if (value >= 1e8) return `${(value / 1e8).toFixed(2)}亿手`;
      if (value >= 1e4) return `${(value / 1e4).toFixed(2)}万手`;
      return `${value.toFixed(0)}手`;
    }

    /**
     * Geometry for the focus chart: the plotted points, both paths, the axis ticks
     * and the scale functions the crosshair needs.
     * @param points - `{ t, day, v, avg }` rows.
     * @param options - `{ kind, mode, preClose }`.
     * @returns A plain description, or null when there is nothing to draw.
     */
    function focusGeometry(points, options) {
      const { kind, mode = 1, preClose } = options || {};
      const list = [];
      for (const point of Array.isArray(points) ? points : []) {
        if (point === null || typeof point !== 'object') continue;
        if (typeof point.v !== 'number' || !Number.isFinite(point.v)) continue;
        list.push(point);
      }
      if (list.length < 2) return null;

      const total = mode === 1 && kind !== undefined && SESSIONS[kind] !== undefined
        ? SESSIONS[kind].total
        : undefined;
      const open = sessionOpen(kind, list);
      const xs = list.map((point, index) => {
        if (total !== undefined) {
          const minutes = minutesOf(point.t);
          if (minutes !== undefined) return (sessionElapsed(kind, minutes, open) / total) * FOCUS_PLOT.width;
        }
        return (index / (list.length - 1)) * FOCUS_PLOT.width;
      });

      let min = Infinity;
      let max = -Infinity;
      for (const point of list) {
        if (point.v < min) min = point.v;
        if (point.v > max) max = point.v;
        if (typeof point.avg === 'number' && Number.isFinite(point.avg)) {
          if (point.avg < min) min = point.avg;
          if (point.avg > max) max = point.avg;
        }
      }
      if (typeof preClose === 'number' && Number.isFinite(preClose)) {
        min = Math.min(min, preClose);
        max = Math.max(max, preClose);
      }
      const span = max - min;
      const pad = span === 0 ? Math.max(Math.abs(max) * 0.01, 0.01) : span * 0.08;
      min -= pad;
      max += pad;

      const yOf = (value) => FOCUS_PLOT.height - ((value - min) / (max - min)) * FOCUS_PLOT.height;
      let d = '';
      for (let index = 0; index < list.length; index += 1) {
        d += `${index === 0 ? 'M' : 'L'}${xs[index].toFixed(2)} ${yOf(list[index].v).toFixed(2)}`;
      }
      const area = `${d}L${xs[xs.length - 1].toFixed(2)} ${FOCUS_PLOT.height}L${xs[0].toFixed(2)} ${FOCUS_PLOT.height}Z`;

      let avg = '';
      if (mode === 1) {
        let started = false;
        for (let index = 0; index < list.length; index += 1) {
          const value = list[index].avg;
          if (typeof value !== 'number' || !Number.isFinite(value)) continue;
          avg += `${started ? 'L' : 'M'}${xs[index].toFixed(2)} ${yOf(value).toFixed(2)}`;
          started = true;
        }
        if (!started) avg = '';
      }

      let high = list[0];
      let low = list[0];
      for (const point of list) {
        if (point.v > high.v) high = point;
        if (point.v < low.v) low = point;
      }

      return {
        points: list,
        xs,
        d,
        area,
        avg,
        min,
        max,
        high,
        low,
        yOf,
        preCloseY: typeof preClose === 'number' && Number.isFinite(preClose) ? yOf(preClose) : undefined,
        yTicks: yAxisTicks(min, max, FOCUS_PLOT.height),
        xTicks: xAxisTicks(list, kind, mode, FOCUS_PLOT.width),
      };
    }

    function toNumber(value) {
      if (typeof value === 'number') return Number.isFinite(value) ? value : undefined;
      if (typeof value === 'string' && value.trim() !== '') {
        const parsed = Number(value);
        return Number.isFinite(parsed) ? parsed : undefined;
      }
      return undefined;
    }

    function marketName(market, code) {
      switch (market) {
        case 1: return 'SH';
        case 0: return /^(4|8|92)/.test(String(code)) ? 'BJ' : 'SZ';
        case 116: return 'HK';
        case 105: return 'NASDAQ';
        case 106: return 'NYSE';
        case 107: return 'AMEX';
        default: return String(market === undefined || market === null ? '' : market);
      }
    }

    /** One requested batch, resolved back onto the requested spellings. */
    async function fetchQuotes(inputs, options) {
      const { signal } = options || {};
      const list = (Array.isArray(inputs) ? inputs : [inputs])
        .map((entry) => String(entry === undefined || entry === null ? '' : entry).trim())
        .filter((entry) => entry !== '');
      const plan = list.map(candidateSecids);
      const secids = [];
      for (const group of plan) {
        for (const secid of group) if (secids.indexOf(secid) === -1) secids.push(secid);
      }
      if (secids.length === 0) return { quotes: [], unresolved: list };

      const url = `${BATCH_ENDPOINT}?secids=${encodeURIComponent(secids.join(','))}`
        + `&fields=${BATCH_FIELDS}&invt=2&fltt=2&_=${Date.now()}`;
      const response = await fetch(url, { signal, cache: 'no-store', headers: { accept: 'application/json' } });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const payload = await response.json();

      const diff = payload && payload.data ? payload.data.diff : undefined;
      const rows = Array.isArray(diff) ? diff : diff === undefined || diff === null ? [] : [diff];
      const bySecid = new Map();
      for (const row of rows) bySecid.set(`${row.f13}.${row.f12}`, row);

      const quotes = [];
      const unresolved = [];
      for (let index = 0; index < list.length; index++) {
        let row;
        for (const secid of plan[index]) {
          const hit = bySecid.get(secid);
          if (hit !== undefined) { row = hit; break; }
        }
        if (row === undefined) { unresolved.push(list[index]); continue; }
        const code = row.f12 === undefined || row.f12 === null ? '' : String(row.f12);
        quotes.push({
          symbol: list[index],
          code,
          name: typeof row.f14 === 'string' ? row.f14 : '',
          market: marketName(row.f13, code),
          price: toNumber(row.f2),
          changePct: toNumber(row.f3),
          change: toNumber(row.f4),
          high: toNumber(row.f15),
          low: toNumber(row.f16),
          open: toNumber(row.f17),
          preClose: toNumber(row.f18),
          volume: toNumber(row.f5),
          amount: toNumber(row.f6),
        });
      }
      return { quotes, unresolved };
    }

    /** Read the saved watchlist; a saved empty list stays empty. */
    function readWatchlist() {
      try {
        const raw = window.localStorage.getItem(STORAGE_KEY);
        if (raw !== null) {
          const parsed = JSON.parse(raw);
          if (Array.isArray(parsed)) {
            return parsed
              .filter((entry) => typeof entry === 'string' && entry.trim() !== '')
              .map((entry) => entry.trim());
          }
        }
      } catch {
        /* A blocked or corrupt store falls back to the defaults. */
      }
      return DEFAULT_SYMBOLS.slice();
    }

    function writeWatchlist(list) {
      try {
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
      } catch {
        /* Persisting is a convenience; the page still works without it. */
      }
    }

    /**
     * Display preferences, kept in the browser so the plugin needs no Host
     * plumbing. Only the sidebar/page name is user-configurable; the default is
     * deliberately neutral so the entry does not advertise what it shows.
     */
    const PREFS_KEY = 'dsh-stock-quotes/prefs';
    const NAME_LIMIT = 24;
    const REFRESH_CHOICES = [5, 10, 15, 30, 60];
    const COLUMN_KEYS = ['open', 'high', 'low', 'amount'];
    const prefsListeners = new Set();
    const DEFAULT_PREFS = {
      label: '',
      chart: true,
      refreshSeconds: 15,
      /** `cn` = red up / green down (A-share habit), `intl` = the opposite. */
      convention: 'cn',
      columns: { open: true, high: true, low: true, amount: true },
      /** Absolute daily move, in percent, that raises the in-panel alert. 0 = off. */
      alertPct: 0,
    };

    /** Collapse whitespace and bound the length of a user-supplied name. */
    function cleanLabel(raw) {
      return String(raw === undefined || raw === null ? '' : raw)
        .replace(/\s+/g, ' ')
        .trim()
        .slice(0, NAME_LIMIT);
    }

    /** Coerce one stored preference object into a complete, valid set. */
    function normalisePrefs(parsed) {
      const source = parsed !== null && typeof parsed === 'object' ? parsed : {};
      const refreshSeconds = REFRESH_CHOICES.indexOf(Number(source.refreshSeconds)) === -1
        ? DEFAULT_PREFS.refreshSeconds
        : Number(source.refreshSeconds);
      const alertPct = Number(source.alertPct);
      const columns = {};
      for (const key of COLUMN_KEYS) {
        const value = source.columns !== null && typeof source.columns === 'object' ? source.columns[key] : undefined;
        columns[key] = value === undefined ? DEFAULT_PREFS.columns[key] : value !== false;
      }
      return {
        label: typeof source.label === 'string' ? source.label : DEFAULT_PREFS.label,
        chart: source.chart !== false,
        tickerEnabled: source.tickerEnabled === true,
        refreshSeconds,
        convention: source.convention === 'intl' ? 'intl' : 'cn',
        columns,
        alertPct: Number.isFinite(alertPct) && alertPct > 0 ? Math.min(alertPct, 100) : 0,
      };
    }

    /** Read the saved preferences; anything unreadable falls back to defaults. */
    function readPrefs() {
      try {
        const raw = window.localStorage.getItem(PREFS_KEY);
        if (raw !== null) return normalisePrefs(JSON.parse(raw));
      } catch {
        /* A blocked or corrupt store falls back to the defaults. */
      }
      return normalisePrefs(undefined);
    }

    /**
     * Persist preferences and let the sidebar re-render with the new name. Omitted
     * fields keep their stored value, so changing one control never resets another.
     */
    function writePrefs(next) {
      const current = readPrefs();
      const patch = next !== null && typeof next === 'object' ? next : {};
      const merged = normalisePrefs({
        label: patch.label === undefined ? current.label : cleanLabel(patch.label),
        chart: patch.chart === undefined ? current.chart : patch.chart,
        tickerEnabled: patch.tickerEnabled ?? current.tickerEnabled,
        refreshSeconds: patch.refreshSeconds === undefined ? current.refreshSeconds : patch.refreshSeconds,
        convention: patch.convention === undefined ? current.convention : patch.convention,
        columns: patch.columns === undefined ? current.columns : { ...current.columns, ...patch.columns },
        alertPct: patch.alertPct === undefined ? current.alertPct : patch.alertPct,
      });
      try {
        window.localStorage.setItem(PREFS_KEY, JSON.stringify(merged));
      } catch {
        /* The name change is a convenience; the panel still works without it. */
      }
      for (const listener of [...prefsListeners]) {
        try {
          listener();
        } catch {
          /* One failing listener must not block the others. */
        }
      }
      return merged;
    }


    // The Harness loader serves one browser entry for this bundle.
    // Ticker UI adapted from kfat77/dsh-stock-ticker (see LICENSE-ticker).
    function createTickerOverlay() {
      const { useCallback, useEffect, useMemo, useRef, useState } = React;

      /** Strip height in pixels; the frame's first grid track uses the same value. */
      const STRIP_HEIGHT = 32;
      /** Marquee speed in pixels per second. */
      const MARQUEE_SPEED = 56;
      /** Marquee loop duration bounds in seconds. */
      const MIN_LOOP_SECONDS = 20;
      const MAX_LOOP_SECONDS = 180;

      const API_BASE = '/api/dsh-stock-quotes-plus/ticker';

      const STYLE_ID = 'dsh-stock-ticker-style';

      const CSS = `
:root { --dsh-stock-ticker-height: ${STRIP_HEIGHT}px; }
.dst-root {
  position: absolute;
  inset: 0 0 auto 0;
  height: var(--dsh-stock-ticker-height);
  display: flex;
  align-items: stretch;
  box-sizing: border-box;
  background: var(--dsw-alias-bg-base);
  color: var(--dsw-alias-label-primary);
  font-family: ui-sans-serif, -apple-system, "Segoe UI", "Microsoft YaHei", sans-serif;
  font-size: 12px;
  line-height: 1;
  border-bottom: 1px solid var(--dsw-alias-border-l2);
  user-select: none;
  pointer-events: auto;
}
.dst-viewport { position: relative; flex: 1 1 auto; min-width: 0; overflow: hidden; display: flex; align-items: center; }
.dst-track { display: flex; align-items: center; width: max-content; animation: dst-scroll linear infinite; will-change: transform; }
.dst-track[data-paused="true"] { animation-play-state: paused; }
@keyframes dst-scroll { from { transform: translate3d(0, 0, 0); } to { transform: translate3d(-50%, 0, 0); } }
.dst-copy { display: flex; align-items: center; }
.dst-measure { position: absolute; top: 0; left: 0; display: flex; align-items: center; visibility: hidden; pointer-events: none; }
.dst-item { display: flex; align-items: center; gap: 7px; padding: 0 14px; height: ${STRIP_HEIGHT}px; white-space: nowrap; border-right: 1px solid var(--dsw-alias-border-l2); cursor: pointer; }
.dst-item:hover, .dst-item:focus-visible { background: var(--dsw-alias-bg-layer-2); outline: none; }
.dst-item-alert { animation: dst-alert 1.8s ease-in-out infinite; }
@keyframes dst-alert {
  0%, 100% { background: transparent; }
  50% { background: rgba(255, 176, 32, 0.14); }
}
.dst-detail { position: absolute; top: calc(100% + 6px); left: 8px; width: 260px; box-sizing: border-box; padding: 12px 14px 14px; border-radius: 10px; background: var(--dsw-alias-bg-overlay); border: 1px solid var(--dsw-alias-border-l2); box-shadow: 0 12px 32px rgba(0, 0, 0, 0.45); color: var(--dsw-alias-label-primary); z-index: 30; font-size: 12px; cursor: default; }
.dst-detail-head { display: flex; align-items: flex-start; justify-content: space-between; gap: 8px; }
.dst-detail-name { font-size: 13px; font-weight: 650; }
.dst-detail-symbol { margin-top: 2px; color: var(--dsw-alias-label-secondary); font-size: 11px; }
.dst-detail-price { display: flex; align-items: baseline; gap: 8px; margin: 10px 0 12px; font-size: 22px; font-weight: 650; font-variant-numeric: tabular-nums; }
.dst-detail-price .dst-change { font-size: 12px; font-weight: 650; }
.dst-detail-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 8px 12px; }
.dst-detail-label { color: var(--dsw-alias-label-secondary); font-size: 11px; }
.dst-detail-value { font-variant-numeric: tabular-nums; }
.dst-detail-time { margin-top: 12px; color: var(--dsw-alias-label-secondary); font-size: 11px; }
.dst-symbol { font-weight: 650; letter-spacing: 0.02em; color: var(--dsw-alias-label-primary); }
.dst-price { font-variant-numeric: tabular-nums; color: var(--dsw-alias-label-secondary); }
.dst-change { font-variant-numeric: tabular-nums; font-weight: 650; }
.dst-arrow { font-size: 9px; margin-right: 1px; }
.dst-up { color: var(--dsw-alias-state-success-primary); }
.dst-down { color: var(--dsw-alias-state-error-primary); }
.dst-flat { color: var(--dsw-alias-label-secondary); }
.dst-message { padding: 0 16px; color: var(--dsw-alias-label-secondary); display: flex; align-items: center; gap: 8px; }
.dst-retry { background: var(--dsw-alias-bg-layer-2); border: 0; border-radius: 4px; color: var(--dsw-alias-label-primary); font: inherit; padding: 3px 8px; cursor: pointer; }
.dst-retry:hover { background: var(--dsw-alias-bg-layer-2); }
.dst-actions { display: flex; align-items: center; gap: 2px; padding: 0 6px; border-left: 1px solid var(--dsw-alias-border-l2); background: var(--dsw-alias-bg-base); }
.dst-icon-button { display: flex; align-items: center; justify-content: center; width: 24px; height: 24px; border: 0; border-radius: 5px; background: transparent; color: var(--dsw-alias-label-secondary); cursor: pointer; padding: 0; }
.dst-icon-button:hover, .dst-icon-button[aria-expanded="true"] { background: var(--dsw-alias-bg-layer-2); color: var(--dsw-alias-label-primary); }
.dst-notice { max-width: 300px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; padding-left: 6px; color: var(--dsw-alias-state-warn-primary); font-size: 11px; }
.dst-panel { position: absolute; top: calc(100% + 6px); right: 8px; width: 320px; box-sizing: border-box; padding: 14px; border-radius: 10px; background: var(--dsw-alias-bg-overlay); border: 1px solid var(--dsw-alias-border-l2); box-shadow: 0 12px 32px rgba(0, 0, 0, 0.45); color: var(--dsw-alias-label-primary); z-index: 30; font-size: 12px; }
.dst-panel-title { font-size: 13px; font-weight: 650; margin-bottom: 10px; }
.dst-label { display: block; margin: 10px 0 4px; color: var(--dsw-alias-label-secondary); }
.dst-textarea, .dst-input { width: 100%; box-sizing: border-box; background: var(--dsw-alias-bg-base); border: 1px solid var(--dsw-alias-border-l2); border-radius: 6px; color: var(--dsw-alias-label-primary); font: inherit; padding: 6px 8px; outline: none; }
.dst-textarea { resize: vertical; min-height: 64px; font-family: ui-monospace, SFMono-Regular, Consolas, monospace; }
.dst-textarea:focus, .dst-input:focus { border-color: var(--dsw-alias-brand-primary); }
.dst-hint { margin-top: 6px; color: var(--dsw-alias-label-secondary); font-size: 11px; line-height: 1.5; }
.dst-error { margin-top: 8px; color: var(--dsw-alias-state-error-primary); font-size: 11px; line-height: 1.5; }
.dst-panel-footer { display: flex; justify-content: flex-end; gap: 8px; margin-top: 14px; }
.dst-button { border: 1px solid var(--dsw-alias-border-l2); background: transparent; color: var(--dsw-alias-label-primary); border-radius: 6px; padding: 5px 12px; font: inherit; cursor: pointer; }
.dst-button:hover { background: var(--dsw-alias-bg-layer-2); }
.dst-button-primary { background: var(--dsw-alias-brand-primary); border-color: var(--dsw-alias-brand-primary); color: var(--dsw-alias-bg-base); font-weight: 600; }
.dst-button-primary:hover { background: var(--dsw-alias-brand-primary); }
.dst-button:disabled { opacity: 0.55; cursor: default; }
@media (prefers-reduced-motion: reduce) {
  .dst-track { animation: none; }
  .dst-viewport { overflow-x: auto; }
  .dst-item-alert { animation: none; background: rgba(255, 176, 32, 0.14); }
}
  `;

      /**
       * Format one price-like number.
       * @param value numeric value, possibly missing.
       * @returns fixed two-decimal text or an em dash.
       */
      function formatNumber(value) {
        if (typeof value !== 'number' || !Number.isFinite(value)) return '—';
        return value.toFixed(2);
      }

      /**
       * Format a signed change value.
       * @param value numeric change, possibly missing.
       * @returns signed text such as `+1.23`.
       */
      function formatSigned(value) {
        if (typeof value !== 'number' || !Number.isFinite(value)) return '—';
        return `${value > 0 ? '+' : ''}${value.toFixed(2)}`;
      }

      /**
       * Pick the color class for a quote's change.
       * @param changePercent percentage change, possibly missing.
       * @returns CSS class name.
       */
      function toneClass(changePercent) {
        if (typeof changePercent !== 'number' || !Number.isFinite(changePercent) || changePercent === 0) return 'dst-flat';
        return changePercent > 0 ? 'dst-up' : 'dst-down';
      }

      /**
       * Turn a raw marquee distance into a bounded loop duration.
       * @param width total track distance in pixels.
       * @returns loop duration in seconds.
       */
      function loopSecondsFor(width) {
        const seconds = width > 0 ? width / MARQUEE_SPEED : MIN_LOOP_SECONDS;
        return Math.min(MAX_LOOP_SECONDS, Math.max(MIN_LOOP_SECONDS, seconds));
      }

      /**
       * One ticker entry.
       * @param props component props with the quote, the alert threshold, and the select callback.
       * @returns rendered entry.
       */
      function TickerItem({ quote, flashPercent, onSelect }) {
        const tone = toneClass(quote.changePercent);
        const arrow = quote.changePercent > 0 ? '▲' : quote.changePercent < 0 ? '▼' : '■';
        const changePercent = quote.changePercent;
        const alerting =
          flashPercent > 0 &&
          typeof changePercent === 'number' &&
          Number.isFinite(changePercent) &&
          Math.abs(changePercent) >= flashPercent;
        return h(
          'div',
          {
            className: alerting ? 'dst-item dst-item-alert' : 'dst-item',
            role: 'button',
            tabIndex: 0,
            title: `${quote.symbol} ${quote.name || ''} ${quote.time || ''}`.trim(),
            'aria-label': `${quote.symbol} ${quote.name || ''}`.trim(),
            onClick: () => onSelect(quote),
            onKeyDown: (event) => {
              if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault();
                onSelect(quote);
              }
            },
          },
          h('span', { className: 'dst-symbol' }, quote.symbol),
          h('span', { className: 'dst-price' }, formatNumber(quote.price)),
          h(
            'span',
            { className: `dst-change ${tone}` },
            h('span', { className: 'dst-arrow', 'aria-hidden': 'true' }, arrow),
            formatSigned(quote.change),
            ` (${formatSigned(quote.changePercent)}%)`,
          ),
        );
      }

      /**
       * Detail card for one quote: the fields the strip has no room for.
       * @param props component props with the quote and the close callback.
       * @returns rendered card.
       */
      function QuoteDetail({ quote, onClose }) {
        const rows = [
          ['今开', formatNumber(quote.open)],
          ['最高', formatNumber(quote.high)],
          ['最低', formatNumber(quote.low)],
          ['昨收', formatNumber(quote.previousClose)],
        ];
        return h(
          'div',
          { className: 'dst-detail', role: 'dialog', 'aria-label': `${quote.symbol} 行情详情` },
          h(
            'div',
            { className: 'dst-detail-head' },
            h(
              'div',
              null,
              h('div', { className: 'dst-detail-name' }, quote.name || quote.symbol),
              h('div', { className: 'dst-detail-symbol' }, `${quote.symbol}${quote.currency ? ` · ${quote.currency}` : ''}`),
            ),
            h(
              'button',
              { type: 'button', className: 'dst-icon-button', onClick: onClose, 'aria-label': '关闭详情' },
              '✕',
            ),
          ),
          h(
            'div',
            { className: 'dst-detail-price' },
            formatNumber(quote.price),
            h(
              'span',
              { className: `dst-change ${toneClass(quote.changePercent)}` },
              `${formatSigned(quote.change)} (${formatSigned(quote.changePercent)}%)`,
            ),
          ),
          h(
            'div',
            { className: 'dst-detail-grid' },
            ...rows.map(([label, value]) =>
              h(
                'div',
                { className: 'dst-detail-cell', key: label },
                h('div', { className: 'dst-detail-label' }, label),
                h('div', { className: 'dst-detail-value' }, value),
              ),
            ),
          ),
          quote.time ? h('div', { className: 'dst-detail-time' }, `行情时间 ${quote.time}`) : null,
        );
      }

      /**
       * Reserve the strip's space in the shell frame.
       *
       * The overlay layer is the frame's absolutely positioned child; walking up from
       * the strip finds it and its frame. The frame already carries a padding equal to
       * the window chrome band (Windows caption row, macOS traffic lights), and content
       * natively painted over the page top keeps that band. The strip is offset below
       * that band, and the same amount is added to the frame's top padding so the
       * columns shift down instead of being covered.
       * @param rootRef ref to the strip element.
       */
      function useFrameSpace(rootRef) {
        useEffect(() => {
          const root = rootRef.current;
          if (root === null) return undefined;
          let layer = root.parentElement;
          while (layer !== null && !layer.hasAttribute('data-shell-overlay')) layer = layer.parentElement;
          const frame = layer?.parentElement;
          if (frame === undefined || frame === null) return undefined;
          frame.setAttribute('data-dsh-stock-ticker-frame', '');
          const originalPadding = frame.style.paddingTop;
          const measure = () => {
            frame.style.paddingTop = originalPadding;
            const chromeTop = Number.parseFloat(window.getComputedStyle(frame).paddingTop) || 0;
            frame.style.paddingTop = `${chromeTop + STRIP_HEIGHT}px`;
            root.style.top = `${chromeTop}px`;
          };
          measure();
          window.addEventListener('resize', measure);
          return () => {
            window.removeEventListener('resize', measure);
            frame.removeAttribute('data-dsh-stock-ticker-frame');
            frame.style.paddingTop = originalPadding;
            root.style.top = '';
          };
        }, [rootRef]);
      }


      /**
       * Settings popover: edit the watchlist and the refresh interval.
       * @param props current settings, pending state, and callbacks.
       * @returns rendered popover.
       */
      function SettingsPanel({ data, saving, error, onSave, onClose }) {
        const [symbols, setSymbols] = useState((data?.symbols ?? []).join(', '));
        const [refresh, setRefresh] = useState(String(data?.refreshSeconds ?? 15));
        const [flash, setFlash] = useState(String(data?.flashPercent ?? 3));

        useEffect(() => {
          const onKeyDown = (event) => {
            if (event.key === 'Escape') onClose();
          };
          document.addEventListener('keydown', onKeyDown);
          return () => document.removeEventListener('keydown', onKeyDown);
        }, [onClose]);

        return h(
          'div',
          { className: 'dst-panel', role: 'dialog', 'aria-label': '股票行情设置' },
          h('div', { className: 'dst-panel-title' }, '股票行情设置'),
          h('label', { className: 'dst-label', htmlFor: 'dst-symbols' }, '股票代码'),
          h('textarea', {
            id: 'dst-symbols',
            className: 'dst-textarea',
            value: symbols,
            spellCheck: false,
            placeholder: 'AAPL, TSLA, 600519.SH, 00700.HK',
            onChange: (event) => setSymbols(event.target.value),
          }),
          h(
            'div',
            { className: 'dst-hint' },
            '支持 AAPL、600519.SH、000001.SZ、430047.BJ、00700.HK，也可直接写 sh600519；用逗号或换行分隔。',
          ),
          h('label', { className: 'dst-label', htmlFor: 'dst-refresh' }, '刷新频率（秒）'),
          h('input', {
            id: 'dst-refresh',
            className: 'dst-input',
            type: 'number',
            min: 5,
            max: 300,
            step: 1,
            value: refresh,
            onChange: (event) => setRefresh(event.target.value),
          }),
          data?.fetchedAt
            ? h('div', { className: 'dst-hint' }, `最近更新 ${new Date(data.fetchedAt).toLocaleTimeString()}`)
            : null,
          h('label', { className: 'dst-label', htmlFor: 'dst-flash' }, '涨跌提醒阈值（%）'),
          h('input', {
            id: 'dst-flash',
            className: 'dst-input',
            type: 'number',
            min: 0,
            max: 20,
            step: 0.5,
            value: flash,
            onChange: (event) => setFlash(event.target.value),
          }),
          h('div', { className: 'dst-hint' }, '涨跌幅超过该值时，该条目会轻微闪烁提醒；填 0 关闭提醒。'),
          error ? h('div', { className: 'dst-error', role: 'alert' }, error) : null,
          h(
            'div',
            { className: 'dst-panel-footer' },
            h('button', { type: 'button', className: 'dst-button', onClick: onClose, disabled: saving }, '取消'),
            h(
              'button',
              {
                type: 'button',
                className: 'dst-button dst-button-primary',
                disabled: saving,
                onClick: () => onSave(symbols, refresh, flash),
              },
              saving ? '保存中…' : '保存',
            ),
          ),
        );
      }

      /**
       * The strip itself: polling, marquee timing, and the settings popover.
       * @returns rendered strip.
       */
      function TickerBar() {
        const rootRef = useRef(null);
        const viewportRef = useRef(null);
        const measureRef = useRef(null);
        const [data, setData] = useState(null);
        const [status, setStatus] = useState('loading');
        const [paused, setPaused] = useState(false);
        const [viewportWidth, setViewportWidth] = useState(0);
        const [passWidth, setPassWidth] = useState(0);
        const [panelOpen, setPanelOpen] = useState(false);
        const [selected, setSelected] = useState(null);
        const [saving, setSaving] = useState(false);
        const [saveError, setSaveError] = useState('');
        const [notice, setNotice] = useState('');

        useFrameSpace(rootRef);

        const load = useCallback(async () => {
          try {
            const response = await fetch(`${API_BASE}/quotes`, { headers: { accept: 'application/json' } });
            if (!response.ok) throw new Error(`HTTP ${response.status}`);
            const payload = await response.json();
            if (payload?.ok === false) throw new Error(payload.error || '请求失败');
            setData(payload);
            setStatus('ready');
          } catch (error) {
            setStatus((current) => (current === 'ready' ? 'stale' : 'error'));
            setSaveError('');
            // Keep the previous payload on screen; the next poll may recover.
            console.warn('[dsh-stock-ticker] quote request failed:', error instanceof Error ? error.message : error);
          }
        }, []);

        useEffect(() => {
          let cancelled = false;
          const run = () => {
            if (!cancelled) void load();
          };
          run();
          const refreshMs = Math.max(5, Number(data?.refreshSeconds) || 15) * 1000;
          const timer = setInterval(run, refreshMs);
          return () => {
            cancelled = true;
            clearInterval(timer);
          };
        }, [data?.refreshSeconds, load]);

        useEffect(() => {
          const onVisible = () => {
            if (document.visibilityState === 'visible') void load();
          };
          document.addEventListener('visibilitychange', onVisible);
          return () => document.removeEventListener('visibilitychange', onVisible);
        }, [load]);

        const quotes = Array.isArray(data?.quotes) ? data.quotes : [];

        useEffect(() => {
          const viewport = viewportRef.current;
          const measure = measureRef.current;
          if (viewport === null || measure === null) return undefined;
          const update = () => {
            setViewportWidth(viewport.clientWidth);
            setPassWidth(measure.scrollWidth);
          };
          update();
          if (typeof window.ResizeObserver !== 'function') return undefined;
          const observer = new window.ResizeObserver(update);
          observer.observe(viewport);
          observer.observe(measure);
          return () => observer.disconnect();
        }, [quotes.length]);

        const onSave = useCallback(
          async (symbols, refresh, flash) => {
            setSaving(true);
            setSaveError('');
            setNotice('');
            try {
              const response = await fetch(`${API_BASE}/config`, {
                method: 'POST',
                headers: { 'content-type': 'application/json' },
                body: JSON.stringify({
                  symbols: String(symbols)
                    .split(/[\s,，;；、]+/)
                    .map((item) => item.trim())
                    .filter((item) => item !== ''),
                  refreshSeconds: Number(refresh),
                  flashPercent: Number(flash),
                }),
              });
              const payload = await response.json().catch(() => ({}));
              if (!response.ok || payload?.ok === false) {
                throw new Error(payload?.error || `HTTP ${response.status}`);
              }
              setData((current) => ({ ...(current ?? {}), ...payload }));
              setStatus('ready');
              setPanelOpen(false);
              if (payload.invalidSymbols?.length) {
                setNotice(`已忽略无法识别的代码：${payload.invalidSymbols.join('、')}`);
              } else if (payload.persisted === false) {
                setNotice('已生效，但未能写入配置，重启后将恢复默认值。');
              }
              void load();
            } catch (error) {
              setSaveError(error instanceof Error ? error.message : String(error));
            } finally {
              setSaving(false);
            }
          },
          [load],
        );

        const closePanel = useCallback(() => setPanelOpen(false), []);

        useEffect(() => {
          if (notice === '') return undefined;
          const id = setTimeout(() => setNotice(''), 6000);
          return () => clearTimeout(id);
        }, [notice]);

        useEffect(() => {
          if (selected === null) return undefined;
          const onKeyDown = (event) => {
            if (event.key === 'Escape') setSelected(null);
          };
          const onPointerDown = (event) => {
            const root = rootRef.current;
            if (root !== null && event.target instanceof window.Node && root.contains(event.target)) return;
            setSelected(null);
          };
          document.addEventListener('keydown', onKeyDown);
          document.addEventListener('mousedown', onPointerDown);
          return () => {
            document.removeEventListener('keydown', onKeyDown);
            document.removeEventListener('mousedown', onPointerDown);
          };
        }, [selected]);

        const flashPercent = Number.isFinite(Number(data?.flashPercent)) ? Number(data.flashPercent) : 3;

        const singlePass = useMemo(
          () => quotes.map((quote) => h(TickerItem, { key: quote.symbol, quote, flashPercent, onSelect: setSelected })),
          // `setSelected` is stable; `quotes` is rebuilt by each poll, so the items
          // follow the refreshed payload.
          [flashPercent, quotes],
        );
        // Repeat the pass until one copy covers the viewport, so a short watchlist
        // never shows a gap between the strip's end and its restart.
        const repeat = passWidth > 0 && viewportWidth > 0 ? Math.max(1, Math.ceil(viewportWidth / passWidth)) : 1;
        const items = useMemo(() => {
          if (repeat === 1) return singlePass;
          const list = [];
          for (let pass = 0; pass < repeat; pass += 1) {
            for (const item of singlePass) {
              list.push(
                h(TickerItem, {
                  key: `${pass}-${item.key}`,
                  quote: item.props.quote,
                  flashPercent: item.props.flashPercent,
                  onSelect: item.props.onSelect,
                }),
              );
            }
          }
          return list;
        }, [repeat, singlePass]);
        const loopSeconds = loopSecondsFor(repeat * passWidth);

        let body;
        if (quotes.length > 0) {
          body = h(
            'div',
            {
              className: 'dst-viewport',
              ref: viewportRef,
              onMouseEnter: () => setPaused(true),
              onMouseLeave: () => setPaused(false),
            },
            h(
              'div',
              { className: 'dst-measure', ref: measureRef, 'aria-hidden': 'true' },
              singlePass,
            ),
            h(
              'div',
              { className: 'dst-track', 'data-paused': paused ? 'true' : 'false', style: { animationDuration: `${loopSeconds}s` } },
              h('div', { className: 'dst-copy' }, items),
              h('div', { className: 'dst-copy', 'aria-hidden': 'true' }, items),
            ),
          );
        } else if (status === 'error') {
          body = h(
            'div',
            { className: 'dst-viewport' },
            h(
              'div',
              { className: 'dst-message' },
              h('span', null, '行情加载失败'),
              h('button', { type: 'button', className: 'dst-retry', onClick: () => void load() }, '重试'),
            ),
          );
        } else {
          body = h('div', { className: 'dst-viewport' }, h('div', { className: 'dst-message' }, '正在加载行情…'));
        }

        const selectedQuote =
          selected === null ? null : quotes.find((quote) => quote.symbol === selected.symbol) ?? selected;

        return h(
          'div',
          { className: 'dst-root', ref: rootRef, role: 'region', 'aria-label': '股票行情' },
          body,
          h(
            'div',
            { className: 'dst-actions' },
            notice ? h('span', { className: 'dst-notice', title: notice }, notice) : null,
            h(
              'button',
              {
                type: 'button',
                className: 'dst-icon-button',
                title: notice || '行情设置',
                'aria-label': '行情设置',
                'aria-expanded': panelOpen ? 'true' : 'false',
                onClick: () => {
                  setSelected(null);
                  setPanelOpen((open) => !open);
                },
              },
              h(
                'svg',
                { viewBox: '0 0 16 16', width: 14, height: 14, 'aria-hidden': 'true', fill: 'currentColor' },
                h('path', {
                  d: 'M8 5.2a2.8 2.8 0 1 0 0 5.6 2.8 2.8 0 0 0 0-5.6Zm0 1.4a1.4 1.4 0 1 1 0 2.8 1.4 1.4 0 0 1 0-2.8Z',
                }),
                h('path', { d: 'M7.1 1h1.8l.3 1.7c.3.1.7.2 1 .4l1.5-.9 1.3 1.3-.9 1.5c.2.3.3.7.4 1l1.7.3v1.8l-1.7.3c-.1.3-.2.7-.4 1l.9 1.5-1.3 1.3-1.5-.9c-.3.2-.7.3-1 .4L8.9 15H7.1l-.3-1.7c-.3-.1-.7-.2-1-.4l-1.5.9-1.3-1.3.9-1.5c-.2-.3-.3-.7-.4-1L1 8.9V7.1l1.7-.3c.1-.3.2-.7.4-1l-.9-1.5 1.3-1.3 1.5.9c.3-.2.7-.3 1-.4L7.1 1Z', opacity: 0.55 }),
              ),
            ),
            selectedQuote === null
              ? null
              : h(QuoteDetail, { quote: selectedQuote, onClose: () => setSelected(null) }),
            panelOpen
              ? h(SettingsPanel, { data, saving, error: saveError, onSave, onClose: closePanel })
              : null,
          ),
        );
      }

      return function TickerOverlay() {
        const [enabled, setEnabled] = useState(() => readPrefs().tickerEnabled);
        useEffect(() => {
          const sync = () => setEnabled(readPrefs().tickerEnabled);
          const unsubscribe = onPrefsChange(sync);
          window.addEventListener('storage', sync);
          sync();
          return () => {
            unsubscribe();
            window.removeEventListener('storage', sync);
          };
        }, []);
        useEffect(() => {
          if (!enabled) return undefined;
          const style = document.createElement('style');
          style.id = STYLE_ID;
          style.textContent = CSS;
          document.head.appendChild(style);
          return () => style.remove();
        }, [enabled]);
        return enabled ? h(TickerBar) : null;
      };
    }

    const TickerOverlay = createTickerOverlay();

    /** Subscribe to preference changes. */
    function onPrefsChange(listener) {
      prefsListeners.add(listener);
      return () => prefsListeners.delete(listener);
    }

    /** Resolve the translate seat, falling back to the built-in dictionaries. */
    function translate(props) {
      return typeof props.t === 'function'
        ? props.t
        : (key) => (Object.prototype.hasOwnProperty.call(FALLBACK_TEXT, key) ? FALLBACK_TEXT[key] : key);
    }

    /** The name shown in the sidebar, the panel heading and the settings entry. */
    function displayName(t) {
      return cleanLabel(readPrefs().label) || t('panel.defaultLabel');
    }

    function fmt(value) {
      return typeof value === 'number' && Number.isFinite(value) ? value.toFixed(2) : '—';
    }

    function fmtSigned(value) {
      if (typeof value !== 'number' || !Number.isFinite(value)) return '—';
      return `${value > 0 ? '+' : ''}${value.toFixed(2)}`;
    }

    function fmtAmount(value) {
      if (typeof value !== 'number' || !Number.isFinite(value)) return '—';
      if (Math.abs(value) >= 1e8) return `${(value / 1e8).toFixed(2)}亿`;
      if (Math.abs(value) >= 1e4) return `${(value / 1e4).toFixed(2)}万`;
      return value.toFixed(2);
    }

    function toneOf(change) {
      if (typeof change !== 'number' || !Number.isFinite(change) || change === 0) return 'flat';
      return change > 0 ? 'up' : 'down';
    }

    function clockOf(ms) {
      if (!ms) return '';
      const date = new Date(ms);
      const pad = (value) => String(value).padStart(2, '0');
      return `${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
    }

    function describeError(error) {
      if (error instanceof Error && error.message) return error.message;
      return String(error);
    }

    /**
     * Move a group of watchlist entries inside the list.
     *
     * `top`/`bottom` hoist or sink the whole group; `up`/`down` shift it one slot.
     * Entry identity is the symbol spelling, which is also what the list stores.
     *
     * @param list - current order.
     * @param moving - entries to move.
     * @param mode - `top` | `bottom` | `up` | `down`.
     * @returns The new order; the same array when nothing can move.
     */
    function reorderList(list, moving, mode) {
      const movingSet = new Set(moving);
      const block = list.filter((entry) => movingSet.has(entry));
      if (block.length === 0 || block.length === list.length) return list;
      const rest = list.filter((entry) => !movingSet.has(entry));
      if (mode === 'top') return [...block, ...rest];
      if (mode === 'bottom') return [...rest, ...block];
      if (mode === 'up') {
        // One pass, top to bottom: each moving entry swaps with a non-moving
        // predecessor, which shifts a contiguous block up in one pass too.
        const out = list.slice();
        let moved = false;
        for (let index = 1; index < out.length; index++) {
          if (movingSet.has(out[index]) && !movingSet.has(out[index - 1])) {
            const held = out[index - 1];
            out[index - 1] = out[index];
            out[index] = held;
            moved = true;
          }
        }
        return moved ? out : list;
      }
      if (mode === 'down') {
        const out = list.slice();
        let moved = false;
        for (let index = out.length - 2; index >= 0; index--) {
          if (movingSet.has(out[index]) && !movingSet.has(out[index + 1])) {
            const held = out[index + 1];
            out[index + 1] = out[index];
            out[index] = held;
            moved = true;
          }
        }
        return moved ? out : list;
      }
      return list;
    }

    /**
     * Insert `moving` entries directly before or after `target`.
     * @param list - current order.
     * @param moving - entries to move (dragged row).
     * @param target - the row that was dropped on.
     * @param after - whether the drop landed on the lower half of the target.
     * @returns The new order; the same array when nothing moves.
     */
    function moveNextTo(list, moving, target, after) {
      const movingSet = new Set(moving);
      if (movingSet.has(target)) return list;
      const block = list.filter((entry) => movingSet.has(entry));
      if (block.length === 0 || block.length === list.length) return list;
      const rest = list.filter((entry) => !movingSet.has(entry));
      const index = rest.indexOf(target);
      if (index < 0) return list;
      const at = index + (after ? 1 : 0);
      return [...rest.slice(0, at), ...block, ...rest.slice(at)];
    }

    /**
     * Order a watchlist for display. An unsorted list keeps the stored order (which
     * is what drag-to-reorder edits); a sorted one is a read-only projection, so
     * rows without a quote sink to the bottom instead of jumping around.
     */
    function sortSymbols(list, by, dir, quotes) {
      const source = Array.isArray(list) ? list : [];
      if (by === null || by === undefined || by === 'none') return source.slice();
      const sign = dir === 'asc' ? 1 : -1;
      const valueOf = (symbol) => {
        const quote = quotes === undefined ? undefined : quotes.get(symbol);
        if (quote === undefined || quote === null) return undefined;
        switch (by) {
          case 'name': return quote.name === undefined ? symbol : String(quote.name);
          case 'price': return quote.price;
          case 'change': return quote.change;
          case 'pct': return quote.changePct;
          case 'amount': return quote.amount;
          default: return undefined;
        }
      };
      return source.slice().sort((left, right) => {
        const a = valueOf(left);
        const b = valueOf(right);
        if (a === undefined && b === undefined) return 0;
        if (a === undefined) return 1;
        if (b === undefined) return -1;
        if (typeof a === 'string' || typeof b === 'string') {
          return sign * String(a).localeCompare(String(b), 'zh-Hans-CN');
        }
        return sign * (a - b);
      });
    }

    /** The行情 page registered under the `main` key `stock-quotes`. */
    function StockQuotesPage(props) {
      const t = translate(props);
      const [symbols, setSymbols] = React.useState(readWatchlist);
      const [view, setView] = React.useState({ status: 'loading', quotes: [], updatedAt: 0, error: '' });
      const [auto, setAuto] = React.useState(true);
      const [draft, setDraft] = React.useState('');
      const [selected, setSelected] = React.useState(() => new Set());
      const [menu, setMenu] = React.useState(null);
      const [drag, setDrag] = React.useState(null);
      const [dropAt, setDropAt] = React.useState(null);
      const [notice, setNotice] = React.useState('');
      const [matches, setMatches] = React.useState([]);
      const [chart, setChart] = React.useState(() => readPrefs().chart);
      const [trends, setTrends] = React.useState({});
      const [refreshMs, setRefreshMs] = React.useState(() => readPrefs().refreshSeconds * 1000);
      const [convention, setConvention] = React.useState(() => readPrefs().convention);
      const [columns, setColumns] = React.useState(() => readPrefs().columns);
      const [alertPct, setAlertPct] = React.useState(() => readPrefs().alertPct);
      const [sortBy, setSortBy] = React.useState(null);
      const [sortDir, setSortDir] = React.useState('desc');
      const failuresRef = React.useRef(0);
      const [focus, setFocus] = React.useState(null);
      const [focusDays, setFocusDays] = React.useState(1);
      const [focusSeries, setFocusSeries] = React.useState({});
      const [hover, setHover] = React.useState(null);
      const [rowHover, setRowHover] = React.useState(null);
      const focusRef = React.useRef({});
      const symbolsRef = React.useRef(symbols);
      symbolsRef.current = symbols;
      const trendsRef = React.useRef({});
      const menuRef = React.useRef(null);
      const headCheckRef = React.useRef(null);
      const noticeTimer = React.useRef(null);

      const runRefresh = React.useCallback(async (signal) => {
        const list = symbolsRef.current;
        if (list.length === 0) {
          setView({ status: 'ready', quotes: [], updatedAt: Date.now(), error: '' });
          return true;
        }
        try {
          const result = await fetchQuotes(list, signal ? { signal } : undefined);
          if (signal && signal.aborted) return true;
          setView({ status: 'ready', quotes: result.quotes, updatedAt: Date.now(), error: '' });
          return true;
        } catch (error) {
          if (signal && signal.aborted) return true;
          // A failed tick keeps the last good quotes on screen and reports the
          // failure in a strip; blanking the table would be worse than stale data.
          setView((previous) => ({
            ...previous,
            status: previous.quotes.length > 0 ? 'stale' : 'error',
            error: describeError(error),
          }));
          return false;
        }
      }, []);

      // Refetch whenever the watchlist changes, and cancel an in-flight request on
      // unmount or replacement so a stale answer never lands in the table.
      React.useEffect(() => {
        const controller = new AbortController();
        void runRefresh(controller.signal);
        return () => controller.abort();
      }, [runRefresh, symbols]);

      React.useEffect(() => { writeWatchlist(symbols); }, [symbols]);

      // Settings written from the plugin's own card apply to an open panel
      // immediately, without waiting for a reload.
      React.useEffect(() => onPrefsChange(() => {
        const next = readPrefs();
        setChart(next.chart);
        setRefreshMs(next.refreshSeconds * 1000);
        setConvention(next.convention);
        setColumns(next.columns);
        setAlertPct(next.alertPct);
      }), []);

      // Auto refresh with backoff: consecutive failures stretch the interval up to
      // two minutes instead of hammering an endpoint that is already unhappy.
      React.useEffect(() => {
        if (!auto) return undefined;
        let cancelled = false;
        let timer = null;
        const tick = async () => {
          if (cancelled) return;
          if (document.visibilityState !== 'hidden') {
            const ok = await runRefresh();
            failuresRef.current = ok ? 0 : Math.min(failuresRef.current + 1, 3);
          }
          if (cancelled) return;
          timer = window.setTimeout(tick, Math.min(refreshMs * 2 ** failuresRef.current, 120000));
        };
        timer = window.setTimeout(tick, refreshMs);
        return () => {
          cancelled = true;
          if (timer !== null) window.clearTimeout(timer);
        };
      }, [auto, runRefresh, refreshMs]);

      // Intraday lines, only while the chart column is on. One request per entry,
      // refreshed at most every CHART_TTL so a 15-second quote tick does not turn
      // into a burst of history requests.
      React.useEffect(() => {
        if (!chart) return undefined;
        let cancelled = false;
        const load = async () => {
          try {
            const wanted = symbolsRef.current.filter((symbol) => {
              const entry = trendsRef.current[symbol];
              return entry === undefined || Date.now() - entry.at > CHART_TTL;
            }).slice(0, 40);
            if (wanted.length === 0) return;
            const settled = await mapLimit(wanted, TREND_CONCURRENCY, async (symbol) => {
              try {
                const points = await fetchTrend(symbol);
                return [symbol, points];
              } catch {
                return null;
              }
            });
            if (cancelled) return;
            const next = { ...trendsRef.current };
            let changed = false;
            for (const item of settled) {
              if (item === null) continue;
              next[item[0]] = { at: Date.now(), points: item[1] };
              changed = true;
            }
            if (!changed) return;
            trendsRef.current = next;
            setTrends(next);
          } catch (error) {
            // A failed chart refresh must never take the panel down, and must never
            // fail silently: the next tick retries, and the console keeps the reason.
            console.error('[dsh-stock-quotes] intraday refresh failed', error);
          }
        };
        void load();
        const id = window.setInterval(() => {
          if (document.visibilityState === 'hidden') return;
          void load();
        }, CHART_TTL);
        return () => {
          cancelled = true;
          window.clearInterval(id);
        };
      }, [chart, symbols]);

      // The focus chart: one series per (symbol, day count), fetched on demand and
      // refreshed on the same slow cadence as the sparklines.
      React.useEffect(() => {
        if (focus === null) return undefined;
        const key = `${focus}|${focusDays}`;
        let cancelled = false;
        const load = async () => {
          const cached = focusRef.current[key];
          if (cached !== undefined && Date.now() - cached.at < CHART_TTL) return;
          try {
            const points = await fetchTrend(focus, undefined, focusDays);
            if (cancelled) return;
            const next = { ...focusRef.current, [key]: { at: Date.now(), points } };
            focusRef.current = next;
            setFocusSeries(next);
          } catch {
            /* keep whatever is already on screen */
          }
        };
        void load();
        const id = window.setInterval(() => {
          if (document.visibilityState === 'hidden') return;
          void load();
        }, CHART_TTL);
        return () => {
          cancelled = true;
          window.clearInterval(id);
        };
      }, [focus, focusDays]);

      // Close the context menu on anything that would leave it stranded.
      React.useEffect(() => {
        if (menu === null) return undefined;
        const close = () => setMenu(null);
        const onPointerDown = (event) => {
          if (menuRef.current !== null && menuRef.current.contains(event.target)) return;
          setMenu(null);
        };
        const onKeyDown = (event) => {
          if (event.key === 'Escape') setMenu(null);
        };
        document.addEventListener('mousedown', onPointerDown, true);
        document.addEventListener('keydown', onKeyDown, true);
        window.addEventListener('resize', close);
        window.addEventListener('scroll', close, true);
        return () => {
          document.removeEventListener('mousedown', onPointerDown, true);
          document.removeEventListener('keydown', onKeyDown, true);
          window.removeEventListener('resize', close);
          window.removeEventListener('scroll', close, true);
        };
      }, [menu]);

      React.useEffect(() => {
        if (menu === null || menuRef.current === null) return;
        menuRef.current.focus();
      }, [menu]);

      React.useEffect(() => {
        if (headCheckRef.current === null) return;
        headCheckRef.current.indeterminate = selected.size > 0 && selected.size < symbols.length;
      }, [selected, symbols]);

      React.useEffect(() => () => {
        if (noticeTimer.current !== null) window.clearTimeout(noticeTimer.current);
      }, []);

      React.useEffect(() => {
        const query = draft.trim();
        if (query === '') {
          setMatches([]);
          return undefined;
        }
        let cancelled = false;
        const timer = window.setTimeout(() => {
          void loadIndex()
            .then((payload) => {
              if (!cancelled) setMatches(searchIndex(payload.entries, query));
            })
            .catch(() => {
              if (!cancelled) setMatches([]);
            });
        }, 180);
        return () => {
          cancelled = true;
          window.clearTimeout(timer);
        };
      }, [draft]);

      const flash = (text) => {
        setNotice(text);
        if (noticeTimer.current !== null) window.clearTimeout(noticeTimer.current);
        noticeTimer.current = window.setTimeout(() => {
          noticeTimer.current = null;
          setNotice('');
        }, 1600);
      };

      const copyText = (text) => {
        const clipboard = typeof navigator === 'undefined' ? undefined : navigator.clipboard;
        if (clipboard === undefined || typeof clipboard.writeText !== 'function') {
          flash(t('panel.copyFailed'));
          return;
        }
        clipboard.writeText(text).then(
          () => flash(t('panel.copied')),
          () => flash(t('panel.copyFailed')),
        );
      };

      const addingRef = React.useRef(false);

      const commitSymbol = (entry) => {
        const cleaned = String(entry).trim();
        if (cleaned === '') return;
        setSymbols((previous) => (previous.some((item) => item.toLowerCase() === cleaned.toLowerCase())
          ? previous
          : previous.concat(cleaned)));
        setDraft('');
        setMatches([]);
      };

      const addSymbol = async (event) => {
        event.preventDefault();
        if (addingRef.current) return;
        const value = draft.trim();
        if (value === '') return;
        // A typed code wins over a suggestion: it is exactly what the user meant.
        if (candidateSecids(value).length > 0) {
          commitSymbol(value);
          return;
        }
        if (matches.length > 0) {
          commitSymbol(matches[0][1]);
          return;
        }
        // Not a code. A 同花顺 board code (88xxxx) is private to 同花顺 and has no
        // public mapping, so point at the two spellings that do work.
        if (/^88\d{4}$/.test(value)) {
          flash(t('panel.thsBoardCode'));
          return;
        }
        if (!/[\u4e00-\u9fa5]/.test(value)) {
          flash(t('panel.notFound'));
          return;
        }
        addingRef.current = true;
        flash(t('panel.resolving'));
        try {
          const code = await resolveBoard(value);
          if (code === '') flash(t('panel.notFound'));
          else commitSymbol(code);
        } catch {
          flash(t('panel.notFound'));
        } finally {
          addingRef.current = false;
        }
      };

      const toggleSelected = (symbol) => {
        setSelected((previous) => {
          const next = new Set(previous);
          if (next.has(symbol)) next.delete(symbol);
          else next.add(symbol);
          return next;
        });
      };
      const selectAll = () => setSelected(new Set(symbolsRef.current));
      const clearSelection = () => setSelected(new Set());

      const removeMany = (list) => {
        const drop = new Set(list);
        setSymbols((previous) => previous.filter((entry) => !drop.has(entry)));
        setSelected((previous) => {
          const next = new Set(previous);
          for (const symbol of drop) next.delete(symbol);
          return next;
        });
        setMenu(null);
      };

      const moveMany = (list, mode) => {
        setSymbols((previous) => reorderList(previous, list, mode));
        setMenu(null);
      };

      /** A row action applies to the whole selection when that row is selected. */
      const scopeFor = (symbol) => (selected.has(symbol)
        ? symbols.filter((entry) => selected.has(entry))
        : [symbol]);

      const openMenu = (symbol, event) => {
        event.preventDefault();
        setMenu({ symbol, x: event.clientX, y: event.clientY });
      };

      /**
       * The focus chart: a full-width intraday line for the most recently clicked
       * row, with an axis, a previous-close baseline, the day's average and a
       * crosshair that reads out the value under the pointer.
       */
      const buildFocusPanel = () => {
        const cached = focusSeries[`${focus}|${focusDays}`];
        const points = cached === undefined ? [] : cached.points;
        const quote = quoteBySymbol.get(focus);
        const kind = sessionKindOf(quote === undefined ? undefined : quote.market);
        const preClose = quote === undefined ? undefined : quote.preClose;
        const hasPreClose = typeof preClose === 'number' && Number.isFinite(preClose);
        const geometry = focusGeometry(points, { kind, mode: focusDays, preClose });
        const stroke = quote === undefined || quote.change === undefined || quote.change === 0
          ? 'var(--dsw-alias-state-idle-primary)'
          : quote.change > 0
            ? 'var(--dsw-alias-state-error-primary)'
            : 'var(--dsw-alias-state-success-primary)';
        const cursor = geometry === null || hover === null ? undefined : geometry.points[hover];
        const axis = { fill: 'var(--dsw-alias-label-secondary)', fontSize: '11' };
        const grid = 'var(--dsw-alias-border-l1)';

        return h('div', { className: 'dsq-focus', key: 'focus' },
          h('div', { className: 'dsq-focus-head' },
            h('span', { className: 'dsq-focus-title' },
              quote === undefined ? focus : (quote.name || quote.code),
              h('span', { className: 'dsq-focus-code' },
                `${focus}${quote === undefined ? '' : ` · ${quote.market}`}`)),
            quote === undefined
              ? null
              : h('span', { className: `dsq-focus-price ${quote === undefined ? '' : `dsq-${toneOf(quote.change)}`}` },
                `${fmt(quote.price)} ${fmtSigned(quote.change)} (${fmtSigned(quote.changePct)}%)`),
            geometry === null
              ? null
              : h('span', { className: 'dsq-focus-extra' },
                `${t('focus.high')} ${fmt(geometry.high.v)} · ${t('focus.low')} ${fmt(geometry.low.v)}`),
            h('span', { className: 'dsq-grow' }),
            h('button', {
              type: 'button',
              className: 'dsq-btn',
              'aria-pressed': focusDays === 1,
              onClick: () => { setFocusDays(1); setHover(null); },
            }, t('focus.days1')),
            h('button', {
              type: 'button',
              className: 'dsq-btn',
              'aria-pressed': focusDays === 5,
              onClick: () => { setFocusDays(5); setHover(null); },
            }, t('focus.days5')),
            h('button', {
              type: 'button',
              className: 'dsq-btn',
              'aria-label': t('focus.close'),
              onClick: () => { setFocus(null); setHover(null); },
            }, '\u00d7')),
          geometry === null
            ? h('div', { className: 'dsq-focus-empty' }, t('panel.loading'))
            : h('svg', {
              viewBox: `0 0 ${FOCUS_BOX.width} ${FOCUS_BOX.height}`,
              role: 'img',
              'aria-label': t('panel.chart'),
              onPointerMove: (event) => {
                const rect = event.currentTarget.getBoundingClientRect();
                if (rect.width <= 0) return;
                const inBox = ((event.clientX - rect.left) / rect.width) * FOCUS_BOX.width;
                setHover(nearestIndex(points, (inBox - FOCUS_BOX.left) / FOCUS_PLOT.width, kind, focusDays));
              },
              onPointerLeave: () => setHover(null),
            },
            h('g', { transform: `translate(${FOCUS_BOX.left} ${FOCUS_BOX.top})` },
              geometry.yTicks.map((tick) => h('g', { key: `gy${tick.value}` },
                h('line', { x1: 0, x2: FOCUS_PLOT.width, y1: tick.y, y2: tick.y, stroke: grid, strokeWidth: '1' }),
                h('text', { x: FOCUS_PLOT.width + 8, y: tick.y + 4, ...axis }, fmt(tick.value)))),
              geometry.xTicks.map((tick, index) => h('g', { key: `gx${index}` },
                h('line', { x1: tick.x, x2: tick.x, y1: 0, y2: FOCUS_PLOT.height, stroke: grid, strokeWidth: '1' }),
                h('text', { x: tick.x, y: FOCUS_PLOT.height + 16, textAnchor: 'middle', ...axis }, tick.label))),
              geometry.preCloseY === undefined
                ? null
                : h('line', {
                  x1: 0,
                  x2: FOCUS_PLOT.width,
                  y1: geometry.preCloseY,
                  y2: geometry.preCloseY,
                  stroke: 'var(--dsw-alias-label-secondary)',
                  strokeWidth: '1',
                  strokeDasharray: '4 3',
                }),
              h('path', { d: geometry.area, fill: stroke, fillOpacity: '0.1', stroke: 'none' }),
              geometry.avg === ''
                ? null
                : h('path', {
                  d: geometry.avg,
                  fill: 'none',
                  stroke: 'var(--dsw-alias-label-secondary)',
                  strokeWidth: '1',
                  strokeDasharray: '3 3',
                }),
              h('path', {
                d: geometry.d,
                fill: 'none',
                stroke,
                strokeWidth: '1.6',
                strokeLinejoin: 'round',
                strokeLinecap: 'round',
              }),
              cursor === undefined
                ? null
                : h('g', null,
                  h('line', {
                    x1: geometry.xs[hover],
                    x2: geometry.xs[hover],
                    y1: 0,
                    y2: FOCUS_PLOT.height,
                    stroke: 'var(--dsw-alias-label-secondary)',
                    strokeWidth: '1',
                    strokeDasharray: '3 3',
                  }),
                  h('circle', { cx: geometry.xs[hover], cy: geometry.yOf(cursor.v), r: '3', fill: stroke })))),
          h('div', { className: 'dsq-focus-cursor' },
            cursor === undefined
              ? t('focus.hint')
              : [
                focusDays === 1 ? cursor.t : `${cursor.day} ${cursor.t}`,
                fmt(cursor.v),
                hasPreClose ? `(${fmtSigned(((cursor.v - preClose) / preClose) * 100)}%)` : '',
                `${t('focus.avg')} ${fmt(cursor.avg)}`,
                `${t('focus.vol')} ${formatLots(cursor.vol)}`,
              ].filter((part) => part !== '').join('  ·  ')));
      };

      const quoteBySymbol = new Map(view.quotes.map((quote) => [quote.symbol, quote]));

      /**
       * The sparkline cell. Colour follows the day's change, the same convention as
       * the numbers (red up, green down), and a flat day stays neutral.
       */
      const chartCell = (symbol, quote) => {
        const entry = trends[symbol];
        const points = entry === undefined ? [] : entry.points;
        const kind = sessionKindOf(quote === undefined ? undefined : quote.market);
        const path = points.length < 2 ? '' : sparklinePath(points, { kind });
        const change = quote === undefined ? undefined : quote.change;
        const stroke = change === undefined || change === 0
          ? 'var(--dsw-alias-state-idle-primary)'
          : change > 0
            ? 'var(--dsw-alias-state-error-primary)'
            : 'var(--dsw-alias-state-success-primary)';
        // Hovering the sparkline scrubs the row's numbers to the point under the
        // pointer, with a marker in the line itself.
        const active = rowHover !== null && rowHover.symbol === symbol && points[rowHover.index] !== undefined;
        let marker = null;
        if (active) {
          const bounds = seriesBounds(points);
          if (bounds !== null) {
            marker = {
              x: seriesXAt(points, rowHover.index, kind),
              y: seriesY(points[rowHover.index].v, bounds.min, bounds.max, 24),
            };
          }
        }
        // The cell is always present while the column is on, even before the series
        // lands: a missing cell would shift every later column in that row.
        return h('div', {
          className: 'dsq-chart',
          role: 'cell',
          onPointerMove: (event) => {
            if (points.length < 2) return;
            const rect = event.currentTarget.getBoundingClientRect();
            if (rect.width <= 0) return;
            const index = nearestIndex(points, (event.clientX - rect.left) / rect.width, kind, 1);
            if (index >= 0) setRowHover({ symbol, index });
          },
          onPointerLeave: () => setRowHover((previous) => (previous !== null && previous.symbol === symbol ? null : previous)),
        },
        path === '' ? null : h('svg', {
          viewBox: '0 0 88 24',
          preserveAspectRatio: 'none',
          'aria-hidden': true,
          focusable: 'false',
        },
        h('path', {
          d: path,
          fill: 'none',
          stroke,
          strokeWidth: '1.2',
          strokeLinecap: 'round',
          strokeLinejoin: 'round',
          vectorEffect: 'non-scaling-stroke',
        }),
        marker === null ? null : h('g', null,
          h('line', {
            x1: marker.x,
            x2: marker.x,
            y1: 0,
            y2: 24,
            stroke: 'var(--dsw-alias-label-secondary)',
            strokeWidth: '0.6',
            strokeDasharray: '2 2',
            vectorEffect: 'non-scaling-stroke',
          }),
          h('circle', { cx: marker.x, cy: marker.y, r: '1.7', fill: stroke }))));
      };

      /** Cycle a column through desc → asc → unsorted. */
      const setSort = (key) => {
        if (sortBy === key) {
          if (sortDir === 'desc') {
            setSortDir('asc');
            return;
          }
          setSortBy(null);
          setSortDir('desc');
          return;
        }
        setSortBy(key);
        setSortDir('desc');
      };

      const sorted = sortBy !== null;
      const viewSymbols = sortSymbols(symbols, sortBy, sortDir, quoteBySymbol);
      const alerting = alertPct > 0
        ? view.quotes.filter((quote) => typeof quote.changePct === 'number'
          && Number.isFinite(quote.changePct)
          && Math.abs(quote.changePct) >= alertPct)
        : [];

      // One grid template for the header and every body row, so the two can never
      // disagree about which columns are on.
      const gridParts = [
        '28px',
        '20px',
        'minmax(140px,1.6fr)',
        chart ? 'minmax(88px,1.1fr)' : '',
        'minmax(78px,.9fr)',
        'minmax(78px,.9fr)',
        'minmax(72px,.9fr)',
        columns.open ? 'minmax(72px,.9fr)' : '',
        columns.high ? 'minmax(72px,.9fr)' : '',
        columns.low ? 'minmax(72px,.9fr)' : '',
        columns.amount ? 'minmax(70px,.85fr)' : '',
      ].filter((part) => part !== '');
      const gridTemplate = gridParts.join(' ');
      const gridMinWidth = 28 + 20 + 140 + (chart ? 88 : 0) + 78 + 78 + 72
        + (columns.open ? 72 : 0) + (columns.high ? 72 : 0) + (columns.low ? 72 : 0) + (columns.amount ? 70 : 0);

      const sortMark = (key) => (sortBy === key ? (sortDir === 'asc' ? ' \u2191' : ' \u2193') : '');
      const sortHead = (key, label) => h('button', {
        type: 'button',
        className: 'dsq-sorth',
        'aria-label': label,
        onClick: () => setSort(key),
      }, `${label}${sortMark(key)}`);

      const rowFor = (symbol) => {
        const quote = quoteBySymbol.get(symbol);
        const tone = quote === undefined ? '' : `dsq-${toneOf(quote.change)}`;
        // While the pointer is over this row's sparkline the three price cells show
        // the point under it instead of the latest tick, so the line can be read.
        const entry = trends[symbol];
        const scrub = rowHover !== null && rowHover.symbol === symbol && entry !== undefined
          ? entry.points[rowHover.index]
          : undefined;
        const preClose = quote === undefined ? undefined : quote.preClose;
        const hasPreClose = typeof preClose === 'number' && Number.isFinite(preClose) && preClose !== 0;
        const scrubbedChange = scrub === undefined || !hasPreClose ? undefined : scrub.v - preClose;
        const scrubbedPct = scrubbedChange === undefined ? undefined : (scrubbedChange / preClose) * 100;
        const cellTone = scrub === undefined ? tone : `dsq-${toneOf(scrubbedChange)}`;
        const isSelected = selected.has(symbol);
        const isDropTarget = dropAt !== null && dropAt.symbol === symbol;
        const className = [
          'dsq-row',
          quote === undefined ? 'dsq-missing' : '',
          isSelected ? 'dsq-selected' : '',
          isDropTarget ? (dropAt.after ? 'dsq-drop-after' : 'dsq-drop-before') : '',
          drag === symbol ? 'dsq-dragging' : '',
          focus === symbol ? 'dsq-focused' : '',
        ].filter((part) => part !== '').join(' ');

        const dashCell = (key) => h('div', { className: 'dsq-num', role: 'cell', key: `dash-${key}` }, '—');
        const optional = [
          columns.open ? (quote === undefined ? dashCell('open') : h('div', { className: 'dsq-num', role: 'cell' }, fmt(quote.open))) : null,
          columns.high ? (quote === undefined ? dashCell('high') : h('div', { className: 'dsq-num', role: 'cell' }, fmt(quote.high))) : null,
          columns.low ? (quote === undefined ? dashCell('low') : h('div', { className: 'dsq-num', role: 'cell' }, fmt(quote.low))) : null,
          columns.amount ? (quote === undefined ? dashCell('amount') : h('div', { className: 'dsq-num', role: 'cell' }, fmtAmount(quote.amount))) : null,
        ].filter((cell) => cell !== null);
        const numeric = quote === undefined
          ? [dashCell('price'), dashCell('change'), dashCell('pct'), ...optional]
          : [
            h('div', { className: `dsq-num ${cellTone}`, role: 'cell' }, fmt(scrub === undefined ? quote.price : scrub.v)),
            h('div', { className: `dsq-num ${cellTone}`, role: 'cell' }, fmtSigned(scrub === undefined ? quote.change : scrubbedChange)),
            h('div', { className: `dsq-num ${cellTone}`, role: 'cell' }, `${fmtSigned(scrub === undefined ? quote.changePct : scrubbedPct)}%`),
            ...optional,
          ];
        // Build the child list instead of emitting a null placeholder, so the row and
        // the header always agree on how many cells they have.
        const rowCells = chart ? [chartCell(symbol, quote), ...numeric] : numeric;

        return h('div', {
          className,
          role: 'row',
          key: symbol,
          tabIndex: 0,
          style: { gridTemplateColumns: gridTemplate },
          'aria-selected': isSelected,
          'aria-label': quote === undefined ? symbol : `${quote.name || quote.code} ${fmt(quote.price)}`,
          onKeyDown: (event) => {
            if (event.key === 'Enter' || event.key === ' ') {
              event.preventDefault();
              setHover(null);
              setFocus((previous) => (previous === symbol ? null : symbol));
            } else if (event.key === 'Escape') {
              setFocus(null);
            }
          },
          onContextMenu: (event) => openMenu(symbol, event),
          onDragOver: (event) => {
            if (drag === null) return;
            event.preventDefault();
            const rect = event.currentTarget.getBoundingClientRect();
            setDropAt({ symbol, after: event.clientY - rect.top > rect.height / 2 });
          },
          onDragLeave: () => setDropAt((previous) => (previous !== null && previous.symbol === symbol ? null : previous)),
          onDrop: (event) => {
            event.preventDefault();
            const after = dropAt !== null && dropAt.symbol === symbol ? dropAt.after : false;
            if (drag !== null) setSymbols((previous) => moveNextTo(previous, [drag], symbol, after));
            setDrag(null);
            setDropAt(null);
          },
          onClick: (event) => {
            const target = event === null || event === undefined ? null : event.target;
            if (target !== null && typeof target.closest === 'function' && target.closest('input,button,a') !== null) return;
            setHover(null);
            setFocus((previous) => (previous === symbol ? null : symbol));
          },
        },
        h('div', { className: 'dsq-pick', role: 'cell' },
          h('input', {
            type: 'checkbox',
            checked: isSelected,
            'aria-label': `${t('menu.select')} ${symbol}`,
            onChange: () => toggleSelected(symbol),
          })),
        h('div', { className: 'dsq-grip-cell', role: 'cell' },
          h('span', {
            className: 'dsq-grip',
            draggable: sorted ? 'false' : 'true',
            title: sorted ? t('panel.sortedHint') : t('panel.drag'),
            'aria-hidden': 'true',
            onDragStart: (event) => {
              if (sorted) return;
              event.dataTransfer.setData('text/plain', symbol);
              event.dataTransfer.effectAllowed = 'move';
              setDrag(symbol);
            },
            onDragEnd: () => {
              setDrag(null);
              setDropAt(null);
            },
          }, '\u28ff')),
        h('div', { className: 'dsq-id', role: 'cell' },
          h('span', { className: 'dsq-name' }, quote === undefined ? symbol : (quote.name || quote.code)),
          h('span', { className: 'dsq-code' }, scrub === undefined
            ? (quote === undefined ? t('panel.unresolved') : `${symbol} · ${quote.market}`)
            : `${symbol} · ${scrub.t}`)),
        ...rowCells);
      };

      const allSelected = symbols.length > 0 && selected.size === symbols.length;
      const headRow = h('div', {
        className: 'dsq-row dsq-headrow',
        role: 'row',
        style: { gridTemplateColumns: gridTemplate },
      },
        h('div', { className: 'dsq-pick', role: 'columnheader' },
          h('input', {
            type: 'checkbox',
            ref: headCheckRef,
            checked: allSelected,
            'aria-label': t('menu.selectAll'),
            onChange: () => {
              if (allSelected) clearSelection();
              else selectAll();
            },
          })),
        h('div', { className: 'dsq-grip-cell', role: 'columnheader', 'aria-hidden': 'true' }),
        h('div', { role: 'columnheader' }, sortHead('name', t('col.name'))),
        ...(chart ? [h('div', { className: 'dsq-chart', role: 'columnheader' }, t('col.trend'))] : []),
        h('div', { className: 'dsq-num', role: 'columnheader' }, sortHead('price', t('col.price'))),
        h('div', { className: 'dsq-num', role: 'columnheader' }, sortHead('change', t('col.change'))),
        h('div', { className: 'dsq-num', role: 'columnheader' }, sortHead('pct', t('col.pct'))),
        ...(columns.open ? [h('div', { className: 'dsq-num', role: 'columnheader' }, t('col.open'))] : []),
        ...(columns.high ? [h('div', { className: 'dsq-num', role: 'columnheader' }, t('col.high'))] : []),
        ...(columns.low ? [h('div', { className: 'dsq-num', role: 'columnheader' }, t('col.low'))] : []),
        ...(columns.amount ? [h('div', { className: 'dsq-num', role: 'columnheader' }, sortHead('amount', t('col.amount')))] : []));

      /** The right-click menu for one row, scoped to the selection when it applies. */
      const buildMenu = () => {
        const { symbol } = menu;
        const scope = scopeFor(symbol);
        const count = scope.length;
        const sized = (key) => (count > 1 ? `${t(key)} (${count})` : t(key));
        const scopeSet = new Set(scope);
        const firstIndex = symbols.findIndex((entry) => scopeSet.has(entry));
        let lastIndex = -1;
        for (let index = 0; index < symbols.length; index++) {
          if (scopeSet.has(symbols[index])) lastIndex = index;
        }
        const canUp = firstIndex > 0;
        const canDown = lastIndex >= 0 && lastIndex < symbols.length - 1;

        const entry = (key, label, action, disabled) => h('button', {
          type: 'button',
          key,
          className: 'dsq-menu-item',
          role: 'menuitem',
          disabled: disabled === true,
          onClick: () => {
            action();
            setMenu(null);
          },
        }, label);

        const width = 200;
        const viewportWidth = typeof window === 'undefined' ? 1200 : window.innerWidth;
        const viewportHeight = typeof window === 'undefined' ? 800 : window.innerHeight;
        const left = Math.max(8, Math.min(menu.x, viewportWidth - width - 8));
        const top = Math.max(8, Math.min(menu.y, viewportHeight - 320));

        return h('div', {
          className: 'dsq-menu',
          role: 'menu',
          ref: menuRef,
          tabIndex: -1,
          'aria-label': t('menu.title'),
          style: { left: `${left}px`, top: `${top}px`, width: `${width}px` },
          onContextMenu: (event) => event.preventDefault(),
        },
        entry('remove', sized('menu.remove'), () => removeMany(scope)),
        entry('copy', sized('menu.copy'), () => copyText(scope.join('\n'))),
        h('div', { className: 'dsq-menu-sep', key: 'sep-move' }),
        entry('top', sized('menu.moveTop'), () => moveMany(scope, 'top'), !canUp),
        entry('up', sized('menu.moveUp'), () => moveMany(scope, 'up'), !canUp),
        entry('down', sized('menu.moveDown'), () => moveMany(scope, 'down'), !canDown),
        entry('bottom', sized('menu.moveBottom'), () => moveMany(scope, 'bottom'), !canDown),
        h('div', { className: 'dsq-menu-sep', key: 'sep-select' }),
        entry('select-all', t('menu.selectAll'), selectAll, symbols.length === 0),
        entry('clear-select', t('menu.clearSelection'), clearSelection, selected.size === 0));
      };

      const status = view.status === 'loading'
        ? t('panel.loading')
        : view.status === 'error'
          ? `${t('panel.error')}：${view.error}`
          : view.updatedAt > 0
            ? `${clockOf(view.updatedAt)} · ${t('panel.convention')} · ${t('panel.source')}`
            : t('panel.source');

      return h(React.Fragment, null,
        h('style', { dangerouslySetInnerHTML: { __html: CSS } }),
        h('div', { className: 'dsq-root', 'data-convention': convention },
          h('div', { className: 'dsq-scroll' },
            h('div', { className: 'dsq-inner' },
              h('div', { className: 'dsq-head' },
                h('h1', { className: 'dsq-title' }, displayName(t)),
                h('span', { className: 'dsq-meta' }, status)),
              h('div', { className: 'dsq-toolbar' },
                h('form', { className: 'dsq-form', onSubmit: addSymbol },
                  h('input', {
                    className: 'dsq-input',
                    type: 'text',
                    value: draft,
                    placeholder: t('panel.placeholder'),
                    'aria-label': t('panel.placeholder'),
                    spellCheck: false,
                    onChange: (event) => setDraft(event.target.value),
                    onKeyDown: (event) => {
                      if (event.key === 'Escape') setMatches([]);
                    },
                  }),
                  h('button', { className: 'dsq-btn', type: 'submit' }, t('panel.add')),
                  matches.length === 0 ? null : h('div', { className: 'dsq-suggest', role: 'listbox' },
                    matches.map(([name, spelling]) => h('button', {
                      type: 'button',
                      key: spelling,
                      className: 'dsq-suggest-item',
                      role: 'option',
                      title: spelling,
                      onClick: () => commitSymbol(spelling),
                    },
                    h('span', { className: 'dsq-suggest-name' }, name),
                    h('span', { className: 'dsq-suggest-code' }, spelling))))),
                h('span', { className: 'dsq-grow' }),
                notice === '' ? null : h('span', { className: 'dsq-notice' }, notice),
                h('button', {
                  type: 'button',
                  className: 'dsq-btn',
                  onClick: () => { void runRefresh(); },
                }, t('panel.refresh')),
                h('button', {
                  type: 'button',
                  className: 'dsq-btn',
                  role: 'switch',
                  'aria-checked': auto,
                  'aria-label': t('panel.auto'),
                  onClick: () => setAuto((value) => !value),
                }, `${t('panel.auto')} ${auto ? `· ${Math.round(refreshMs / 1000)}s` : ''}`.trim()),
                h('button', {
                  type: 'button',
                  className: 'dsq-btn',
                  role: 'switch',
                  'aria-checked': chart,
                  'aria-label': t('panel.chart'),
                  onClick: () => {
                    const next = !chart;
                    setChart(next);
                    writePrefs({ chart: next });
                  },
                }, t('panel.chart'))),
              selected.size === 0
                ? null
                : h('div', { className: 'dsq-selbar' },
                  h('span', { className: 'dsq-selcount' }, `${t('batch.selected')} ${selected.size}`),
                  h('button', {
                    type: 'button',
                    className: 'dsq-btn',
                    onClick: () => removeMany(symbols.filter((entry) => selected.has(entry))),
                  }, t('batch.remove')),
                  h('button', {
                    type: 'button',
                    className: 'dsq-btn',
                    onClick: () => setSymbols((previous) => reorderList(previous, symbols.filter((entry) => selected.has(entry)), 'top')),
                  }, t('batch.top')),
                  h('button', {
                    type: 'button',
                    className: 'dsq-btn',
                    onClick: () => setSymbols((previous) => reorderList(previous, symbols.filter((entry) => selected.has(entry)), 'bottom')),
                  }, t('batch.bottom')),
                  h('button', {
                    type: 'button',
                    className: 'dsq-btn',
                    onClick: clearSelection,
                  }, t('batch.clear'))),
              alerting.length === 0
                ? null
                : h('div', { className: 'dsq-alert', role: 'status' },
                  `${t('panel.alert')} ${alertPct}%：`,
                  alerting.slice(0, 6).map((quote) => `${quote.name || quote.code} ${fmtSigned(quote.changePct)}%`).join(' · ')),
              focus === null ? null : buildFocusPanel(),
              symbols.length === 0
                ? h('div', { className: 'dsq-empty' }, t('panel.empty'))
                : h('div', {
                  className: 'dsq-tablewrap',
                  role: 'table',
                  style: { '--dsq-min-width': `${gridMinWidth}px` },
                },
                h('div', { className: 'dsq-grid' }, headRow, viewSymbols.map(rowFor))),
              view.error === ''
                ? null
                : h('div', { className: 'dsq-error', role: 'status' },
                  `${t('panel.error')}：${view.error}`,
                  h('button', {
                    type: 'button',
                    className: 'dsq-btn',
                    style: { marginLeft: '8px' },
                    onClick: () => { void runRefresh(); },
                  }, t('panel.retry'))),
              h('div', { className: 'dsq-note' },
                t('panel.placeholder')))),
          menu === null ? null : buildMenu()));
    }

    /**
     * Sidebar icon: the owner supplies the square edge. A plain table glyph, so a
     * glance at the rail reads as "some data view" rather than "stock market".
     */
    function PanelIcon(props) {
      const size = typeof props.size === 'number' && props.size > 0 ? props.size : 16;
      return h('svg', {
        viewBox: '0 0 16 16',
        width: size,
        height: size,
        'aria-hidden': true,
        focusable: 'false',
        style: { display: 'block' },
      },
      h('rect', { x: '2.2', y: '3.1', width: '11.6', height: '9.8', rx: '2', fill: 'none', stroke: 'currentColor', strokeWidth: '1.3' }),
      h('path', {
        d: 'M2.6 6.5h10.8M6.4 6.5v6',
        stroke: 'currentColor',
        strokeWidth: '1.1',
        strokeLinecap: 'round',
        fill: 'none',
      }));
    }

    /**
     * The display-name control. Shared by the standalone settings page and the
     * bundle's own page, so both stay in sync and only one form exists.
     */
    function NameSettingForm(props) {
      const t = translate(props);
      const [draft, setDraft] = React.useState(() => readPrefs().label);
      const [prefs, setPrefs] = React.useState(readPrefs);
      const [saved, setSaved] = React.useState(false);
      const [transfer, setTransfer] = React.useState('');
      const [transferNote, setTransferNote] = React.useState('');
      const effective = cleanLabel(draft) || t('panel.defaultLabel');

      const save = (event) => {
        event.preventDefault();
        const next = writePrefs({
          label: draft,
          refreshSeconds: prefs.refreshSeconds,
          convention: prefs.convention,
          columns: prefs.columns,
          alertPct: prefs.alertPct,
        });
        setPrefs(next);
        setSaved(true);
      };
      const reset = () => {
        const next = writePrefs({ label: '' });
        setDraft('');
        setPrefs(next);
        setSaved(true);
      };
      const patch = (partial) => {
        const next = writePrefs(partial);
        setPrefs(next);
        setSaved(true);
      };
      const exportList = () => {
        const payload = JSON.stringify({ version: 1, symbols: readWatchlist() }, null, 2);
        setTransfer(payload);
        setTransferNote(t('settings.exported'));
      };
      const importList = () => {
        try {
          const parsed = JSON.parse(transfer);
          const list = Array.isArray(parsed) ? parsed : parsed.symbols;
          if (!Array.isArray(list)) throw new Error('no symbols');
          const clean = list.filter((entry) => typeof entry === 'string' && entry.trim() !== '');
          writeWatchlist(clean);
          setTransferNote(`${t('settings.imported')} ${clean.length}`);
        } catch {
          setTransferNote(t('settings.importFailed'));
        }
      };

      return h('form', { className: 'dsq-prefs-form', onSubmit: save },
        h('div', { className: 'dsq-prefs-row' },
          h('span', { className: 'dsq-prefs-key' }, t('settings.name')),
          h('div', { className: 'dsq-prefs-field' },
            h('input', {
              className: 'dsq-prefs-input',
              type: 'text',
              value: draft,
              maxLength: NAME_LIMIT,
              placeholder: t('settings.namePlaceholder'),
              'aria-label': t('settings.name'),
              onChange: (event) => {
                setDraft(event.target.value);
                setSaved(false);
              },
            }),
            h('span', { className: 'dsq-prefs-hint' }, t('settings.nameHint')),
            h('span', { className: 'dsq-prefs-hint' }, `${t('settings.effective')}：${effective}`))),
        h('label', { className: 'dsq-prefs-row' },
          h('span', { className: 'dsq-prefs-key' }, t('settings.ticker')),
          h('input', {
            type: 'checkbox',
            checked: prefs.tickerEnabled,
            onChange: (event) => patch({ tickerEnabled: event.target.checked }),
          })),
        h('div', { className: 'dsq-prefs-row' },
          h('span', { className: 'dsq-prefs-key' }, t('settings.refresh')),
          h('div', { className: 'dsq-prefs-field' },
            h('select', {
              className: 'dsq-prefs-input',
              value: prefs.refreshSeconds,
              'aria-label': t('settings.refresh'),
              onChange: (event) => patch({ refreshSeconds: Number(event.target.value) }),
            }, REFRESH_CHOICES.map((seconds) => h('option', { key: seconds, value: seconds }, `${seconds}s`))))),
        h('div', { className: 'dsq-prefs-row' },
          h('span', { className: 'dsq-prefs-key' }, t('settings.convention')),
          h('div', { className: 'dsq-prefs-field' },
            h('select', {
              className: 'dsq-prefs-input',
              value: prefs.convention,
              'aria-label': t('settings.convention'),
              onChange: (event) => patch({ convention: event.target.value }),
            },
            h('option', { value: 'cn' }, t('settings.conventionCn')),
            h('option', { value: 'intl' }, t('settings.conventionIntl'))))),
        h('div', { className: 'dsq-prefs-row' },
          h('span', { className: 'dsq-prefs-key' }, t('settings.columns')),
          h('div', { className: 'dsq-prefs-field' },
            COLUMN_KEYS.map((key) => h('label', { key, className: 'dsq-prefs-check' },
              h('input', {
                type: 'checkbox',
                checked: prefs.columns[key],
                onChange: (event) => patch({ columns: { [key]: event.target.checked } }),
              }),
              t(`col.${key}`))))),
        h('div', { className: 'dsq-prefs-row' },
          h('span', { className: 'dsq-prefs-key' }, t('settings.alert')),
          h('div', { className: 'dsq-prefs-field' },
            h('input', {
              className: 'dsq-prefs-input',
              type: 'number',
              min: 0,
              max: 100,
              step: 0.5,
              value: prefs.alertPct,
              'aria-label': t('settings.alert'),
              onChange: (event) => patch({ alertPct: Number(event.target.value) }),
            }),
            h('span', { className: 'dsq-prefs-hint' }, t('settings.alertHint')))),
        h('div', { className: 'dsq-prefs-row' },
          h('span', { className: 'dsq-prefs-key' }, t('settings.watchlist')),
          h('div', { className: 'dsq-prefs-field' },
            h('textarea', {
              className: 'dsq-prefs-input dsq-prefs-area',
              rows: 3,
              value: transfer,
              placeholder: t('settings.transferPlaceholder'),
              'aria-label': t('settings.watchlist'),
              onChange: (event) => {
                setTransfer(event.target.value);
                setTransferNote('');
              },
            }),
            h('div', { className: 'dsq-prefs-actions' },
              h('button', { className: 'dsq-btn', type: 'button', onClick: exportList }, t('settings.export')),
              h('button', { className: 'dsq-btn', type: 'button', onClick: importList }, t('settings.import')),
              transferNote === '' ? null : h('span', { className: 'dsq-prefs-saved' }, transferNote)))),
        h('div', { className: 'dsq-prefs-actions' },
          h('button', { className: 'dsq-btn', type: 'submit' }, t('settings.save')),
          h('button', { className: 'dsq-btn', type: 'button', onClick: reset }, t('settings.reset')),
          saved ? h('span', { className: 'dsq-prefs-saved' }, t('settings.saved')) : null));
    }

    /**
     * The same control rendered on the bundle's own page in Settings → Plugins,
     * which is where "this plugin's settings" is looked for. The owner asks for a
     * `summary` one-liner in the rows and a full `page` form on the page itself.
     */
    function BundleSettingsCard(props) {
      const t = translate(props);
      if (props.view === 'summary') {
        return h('span', null, `${t('settings.title')}：${displayName(t)}`);
      }
      return h(React.Fragment, null,
        h('style', { dangerouslySetInnerHTML: { __html: CSS } }),
        h('section', { className: 'dsq-card' },
          h('h2', { className: 'dsq-card-title' }, t('settings.cardTitle')),
          h('p', { className: 'dsq-card-desc' }, t('settings.cardDesc')),
          h(NameSettingForm, { t })));
    }

    /**
     * Register the locale namespace, the panel page, the settings page that owns
     * the display name, and the sidebar entry named by that setting.
     */
    function apply(ctx) {
      ctx.effect(() => ctx.locale.register(NS, {
        zh: {
          'panel.defaultLabel': FALLBACK_TEXT['panel.defaultLabel'],
          'panel.auto': FALLBACK_TEXT['panel.auto'],
          'panel.refresh': FALLBACK_TEXT['panel.refresh'],
          'panel.add': FALLBACK_TEXT['panel.add'],
          'panel.placeholder': FALLBACK_TEXT['panel.placeholder'],
          'panel.empty': FALLBACK_TEXT['panel.empty'],
          'panel.notFound': FALLBACK_TEXT['panel.notFound'],
          'panel.resolving': FALLBACK_TEXT['panel.resolving'],
          'panel.thsBoardCode': FALLBACK_TEXT['panel.thsBoardCode'],
          'panel.loading': FALLBACK_TEXT['panel.loading'],
          'panel.error': FALLBACK_TEXT['panel.error'],
          'panel.retry': FALLBACK_TEXT['panel.retry'],
          'panel.unresolved': FALLBACK_TEXT['panel.unresolved'],
          'panel.convention': FALLBACK_TEXT['panel.convention'],
          'panel.source': FALLBACK_TEXT['panel.source'],
          'panel.drag': FALLBACK_TEXT['panel.drag'],
          'panel.chart': FALLBACK_TEXT['panel.chart'],
          'panel.alert': FALLBACK_TEXT['panel.alert'],
          'panel.sortedHint': FALLBACK_TEXT['panel.sortedHint'],
          'focus.high': FALLBACK_TEXT['focus.high'],
          'focus.low': FALLBACK_TEXT['focus.low'],
          'focus.preClose': FALLBACK_TEXT['focus.preClose'],
          'focus.avg': FALLBACK_TEXT['focus.avg'],
          'focus.vol': FALLBACK_TEXT['focus.vol'],
          'focus.days1': FALLBACK_TEXT['focus.days1'],
          'focus.days5': FALLBACK_TEXT['focus.days5'],
          'focus.close': FALLBACK_TEXT['focus.close'],
          'focus.hint': FALLBACK_TEXT['focus.hint'],
          'panel.copied': FALLBACK_TEXT['panel.copied'],
          'panel.copyFailed': FALLBACK_TEXT['panel.copyFailed'],
          'menu.title': FALLBACK_TEXT['menu.title'],
          'menu.remove': FALLBACK_TEXT['menu.remove'],
          'menu.copy': FALLBACK_TEXT['menu.copy'],
          'menu.moveTop': FALLBACK_TEXT['menu.moveTop'],
          'menu.moveUp': FALLBACK_TEXT['menu.moveUp'],
          'menu.moveDown': FALLBACK_TEXT['menu.moveDown'],
          'menu.moveBottom': FALLBACK_TEXT['menu.moveBottom'],
          'menu.selectAll': FALLBACK_TEXT['menu.selectAll'],
          'menu.clearSelection': FALLBACK_TEXT['menu.clearSelection'],
          'menu.select': FALLBACK_TEXT['menu.select'],
          'batch.selected': FALLBACK_TEXT['batch.selected'],
          'batch.remove': FALLBACK_TEXT['batch.remove'],
          'batch.top': FALLBACK_TEXT['batch.top'],
          'batch.bottom': FALLBACK_TEXT['batch.bottom'],
          'batch.clear': FALLBACK_TEXT['batch.clear'],
          'col.name': FALLBACK_TEXT['col.name'],
          'col.trend': FALLBACK_TEXT['col.trend'],
          'col.price': FALLBACK_TEXT['col.price'],
          'col.change': FALLBACK_TEXT['col.change'],
          'col.pct': FALLBACK_TEXT['col.pct'],
          'col.open': FALLBACK_TEXT['col.open'],
          'col.high': FALLBACK_TEXT['col.high'],
          'col.low': FALLBACK_TEXT['col.low'],
          'col.amount': FALLBACK_TEXT['col.amount'],
          'settings.title': FALLBACK_TEXT['settings.title'],
          'settings.cardTitle': FALLBACK_TEXT['settings.cardTitle'],
          'settings.cardDesc': FALLBACK_TEXT['settings.cardDesc'],
          'settings.name': FALLBACK_TEXT['settings.name'],
          'settings.namePlaceholder': FALLBACK_TEXT['settings.namePlaceholder'],
          'settings.nameHint': FALLBACK_TEXT['settings.nameHint'],
          'settings.ticker': FALLBACK_TEXT['settings.ticker'],
          'settings.refresh': FALLBACK_TEXT['settings.refresh'],
          'settings.convention': FALLBACK_TEXT['settings.convention'],
          'settings.conventionCn': FALLBACK_TEXT['settings.conventionCn'],
          'settings.conventionIntl': FALLBACK_TEXT['settings.conventionIntl'],
          'settings.columns': FALLBACK_TEXT['settings.columns'],
          'settings.alert': FALLBACK_TEXT['settings.alert'],
          'settings.alertHint': FALLBACK_TEXT['settings.alertHint'],
          'settings.watchlist': FALLBACK_TEXT['settings.watchlist'],
          'settings.export': FALLBACK_TEXT['settings.export'],
          'settings.import': FALLBACK_TEXT['settings.import'],
          'settings.exported': FALLBACK_TEXT['settings.exported'],
          'settings.imported': FALLBACK_TEXT['settings.imported'],
          'settings.importFailed': FALLBACK_TEXT['settings.importFailed'],
          'settings.transferPlaceholder': FALLBACK_TEXT['settings.transferPlaceholder'],
          'settings.save': FALLBACK_TEXT['settings.save'],
          'settings.reset': FALLBACK_TEXT['settings.reset'],
          'settings.saved': FALLBACK_TEXT['settings.saved'],
          'settings.effective': FALLBACK_TEXT['settings.effective'],
        },
        en: {
          'panel.defaultLabel': 'Data',
          'panel.auto': 'Auto refresh',
          'panel.refresh': 'Refresh',
          'panel.add': 'Add',
          'panel.placeholder': 'Symbol or board name, e.g. 600519, 半导体, 00700',
          'panel.empty': 'Your watchlist is empty. Type a symbol or board name above and press Enter.',
          'panel.notFound': 'No symbol or board matches that',
          'panel.resolving': 'Looking up boards…',
          'panel.thsBoardCode': 'A 同花顺 board code cannot be used here; type the board name (e.g. 半导体) or the Eastmoney code BK1036',
          'panel.loading': 'Loading…',
          'panel.error': 'Quote request failed',
          'panel.retry': 'Retry',
          'panel.unresolved': 'not found',
          'panel.convention': 'red up / green down',
          'panel.source': 'Source: Eastmoney',
          'panel.drag': 'Drag to reorder',
          'panel.chart': 'Charts',
          'panel.alert': 'Moves over',
          'panel.sortedHint': 'Sorted view: clear the sort before dragging',
          'focus.high': 'High',
          'focus.low': 'Low',
          'focus.preClose': 'Prev close',
          'focus.avg': 'Avg',
          'focus.vol': 'Vol',
          'focus.days1': '1D',
          'focus.days5': '5D',
          'focus.close': 'Close',
          'focus.hint': 'Move over the chart to read values',
          'panel.copied': 'Symbols copied',
          'panel.copyFailed': 'Copy failed',
          'menu.title': 'Watchlist actions',
          'menu.remove': 'Delete',
          'menu.copy': 'Copy symbol',
          'menu.moveTop': 'Move to top',
          'menu.moveUp': 'Move up',
          'menu.moveDown': 'Move down',
          'menu.moveBottom': 'Move to bottom',
          'menu.selectAll': 'Select all',
          'menu.clearSelection': 'Clear selection',
          'menu.select': 'Select',
          'batch.selected': 'Selected',
          'batch.remove': 'Delete selected',
          'batch.top': 'Move to top',
          'batch.bottom': 'Move to bottom',
          'batch.clear': 'Clear selection',
          'col.name': 'Name / symbol',
          'col.trend': 'Trend',
          'col.price': 'Price',
          'col.change': 'Change',
          'col.pct': 'Change %',
          'col.open': 'Open',
          'col.high': 'High',
          'col.low': 'Low',
          'col.amount': 'Turnover',
          'settings.title': 'Display name',
          'settings.cardTitle': 'Panel settings',
          'settings.cardDesc': 'Rename the sidebar entry and the panel heading; leave empty for the default.',
          'settings.name': 'Name',
          'settings.namePlaceholder': 'Empty uses the default',
          'settings.nameHint': 'A neutral name that does not describe the contents works best, e.g. "Data", "Reports", "Records".',
          'settings.ticker': 'Show top stock ticker',
          'settings.refresh': 'Refresh interval',
          'settings.convention': 'Up / down colours',
          'settings.conventionCn': 'Red up, green down (China)',
          'settings.conventionIntl': 'Green up, red down (international)',
          'settings.columns': 'Visible columns',
          'settings.alert': 'Move alert threshold (%)',
          'settings.alertHint': 'Show a banner when a symbol moves more than this in a day; 0 disables it.',
          'settings.watchlist': 'Import / export watchlist',
          'settings.export': 'Export into the box below',
          'settings.import': 'Import from the box below',
          'settings.exported': 'Exported — copy it somewhere safe',
          'settings.imported': 'Imported',
          'settings.importFailed': 'Import failed: expected {"symbols": [...]} or an array of strings',
          'settings.transferPlaceholder': '{"version":1,"symbols":["sh600519","hk00700"]}',
          'settings.save': 'Save',
          'settings.reset': 'Reset',
          'settings.saved': 'Saved',
          'settings.effective': 'In effect',
        },
      }), 'stock-quotes: dictionaries');

      const t = ctx.locale.bind(NS);
      /** Re-read on every projection by the sidebar, so a rename needs no reload. */
      const currentName = () => displayName(t);

      ctx.slots.inject('shell.overlay', () => ctx.slots.register({
        name: 'shell.overlay',
        id: 'stock-quotes-plus-ticker',
        order: -100,
      }, TickerOverlay));

      ctx.slots.inject('main', () => ctx.slots.register({
        name: 'main',
        key: PANEL_ID,
        locale: NS,
      }, StockQuotesPage));

      // The bundle's own page is where "this plugin's settings" is looked for, so
      // the same control also renders there (keyed by the package name).
      ctx.slots.inject('plugins.bundle.config', () => ctx.slots.register({
        name: 'plugins.bundle.config',
        key: PKG,
        locale: NS,
      }, BundleSettingsCard));

      const registerIcon = () => ctx.slots.register({
        name: 'sidebar.panellist',
        id: PANEL_ID,
        order: 30,
        label: currentName,
        locale: NS,
      }, PanelIcon);

      // The owner re-reads `label` on every projection, but saving a setting does
      // not re-project the sidebar, so re-register the entry to make a rename show
      // up immediately instead of on the next navigation.
      let disposeIcon = null;
      ctx.slots.inject('sidebar.panellist', () => {
        disposeIcon = registerIcon();
        return () => {
          const dispose = disposeIcon;
          disposeIcon = null;
          if (typeof dispose === 'function') dispose();
        };
      });

      ctx.effect(() => onPrefsChange(() => {
        if (disposeIcon === null) return;
        try {
          disposeIcon();
          disposeIcon = registerIcon();
        } catch {
          // The sidebar declaration is not live right now; slots.inject remounts it.
          disposeIcon = null;
        }
      }), 'stock-quotes: display name');
    }

    return {
      name: NS,
      inject: ['slots', 'locale'],
      apply,
      /** Pure helpers, exported so the smoke test can exercise them. */
      internals: {
        reorderList,
        moveNextTo,
        candidateSecids,
        searchIndex,
        sparklinePath,
        seriesXAt,
        seriesY,
        seriesBounds,
        sortSymbols,
        normalisePrefs,
        mapLimit,
        fetchTrend,
        focusGeometry,
        nearestIndex,
        xAxisTicks,
        yAxisTicks,
        formatLots,
      },
    };
  },
});
