import { AdjustType, Market, NaiveDate, Period, TradeSessions } from 'longbridge';
import { readFile } from 'node:fs/promises';
import { AuthorizationRequired, createQuoteContext } from './oauth.js';

export const SYMBOL_HELP =
  'Use Longbridge symbols such as 600519.SH, 300750.SZ, 700.HK AAPL.US or .IXIC.US. '
  + 'Existing watchlist spellings such as sh600519, hk00700, 116.00700 and AAPL also work.';

const ALIASES = { SS: 'SH', O: 'US', N: 'US', A: 'US' };
const LEGACY_MARKETS = { 1: 'SH', 116: 'HK', 105: 'US', 106: 'US', 107: 'US' };
const CHINA_MARKETS = ['SH', 'SZ', 'BJ'];
const isBeijing = (code) => /^(?:[48]|92)/.test(code);

function marketSymbol(code, market) {
  if (market === 'HK' && /^\d{1,5}$/.test(code)) return [Number(code) + '.HK'];
  if (CHINA_MARKETS.includes(market) && /^\d{6}$/.test(code)) return [code + '.' + market];
  if (market === 'US' && /^\.?[A-Z][A-Z0-9]*(?:[.-][A-Z0-9]+)*$/.test(code) && !/^BK\d+$/.test(code)) {
    return [code + '.US'];
  }
  return [];
}

export function candidateSymbols(input) {
  if (typeof input !== 'string') return [];
  const value = input.trim().toUpperCase();
  if (/^(?:US)?\.?(IXIC|NDX)(\.US)?$/.test(value)) return ['.' + value.replace(/^(?:US)?\.?/, '').replace(/\.US$/, '') + '.US'];
  const suffix = /^(.+)[.-](SH|SS|SZ|BJ|HK|US|O|N|A)$/.exec(value);
  if (suffix) return marketSymbol(suffix[1], ALIASES[suffix[2]] ?? suffix[2]);
  const legacy = /^(\d{1,3})\.(.+)$/.exec(value);
  if (legacy) {
    const market = legacy[1] === '0' ? (isBeijing(legacy[2]) ? 'BJ' : 'SZ') : LEGACY_MARKETS[legacy[1]];
    return marketSymbol(legacy[2], market);
  }
  const prefix = /^(SH|SZ|BJ|HK)(?:[.:_-]|\s)?(\d+)$/i.exec(value)
    ?? /^(US|NASDAQ|NYSE)[.:_\s-]?([A-Z].+)$/i.exec(value);
  if (prefix) {
    const market = prefix[1] === 'SZ' && /^92\d{4}$/.test(prefix[2]) ? 'BJ' : prefix[1];
    return marketSymbol(prefix[2], ['NASDAQ', 'NYSE'].includes(market) ? 'US' : market);
  }
  if (/^\d{6}$/.test(value)) {
    if (isBeijing(value)) return marketSymbol(value, 'BJ');
    return (/^[569]/.test(value) ? ['SH', 'SZ'] : ['SZ', 'SH']).flatMap((market) => marketSymbol(value, market));
  }
  return marketSymbol(value, /^\d+$/.test(value) ? 'HK' : 'US');
}

function toNumber(value) {
  if (value === undefined || value === null || (typeof value === 'string' && value.trim() === '')) return undefined;
  const number = Number(value);
  return Number.isFinite(number) ? number : undefined;
}

export function formatAmount(value) {
  const number = toNumber(value);
  if (number === undefined) return '—';
  if (Math.abs(number) >= 1e8) return (number / 1e8).toFixed(2) + '亿';
  if (Math.abs(number) >= 1e4) return (number / 1e4).toFixed(2) + '万';
  return number.toFixed(2);
}

function normalizeQuote(row, info, spelling) {
  const dot = row.symbol.lastIndexOf('.');
  const code = row.symbol.slice(0, dot);
  const market = row.symbol.slice(dot + 1);
  const price = toNumber(row.lastDone);
  const preClose = toNumber(row.prevClose);
  const change = price !== undefined && preClose > 0 ? price - preClose : undefined;
  const quote = { symbol: spelling, code, name: info?.nameCn || info?.nameEn || code, market };
  const volume = toNumber(row.volume);
  const numeric = {
    price, preClose, change: toNumber(change?.toFixed(8)),
    changePct: change === undefined ? undefined : toNumber((100 * change / preClose).toFixed(8)),
    open: toNumber(row.open), high: toNumber(row.high), low: toNumber(row.low),
    volume, amount: toNumber(row.turnover),
    marketCap: price !== undefined && info?.totalShares > 0 ? toNumber(price * info.totalShares) : undefined,
    floatMarketCap: price !== undefined && info?.circulatingShares > 0 ? toNumber(price * info.circulatingShares) : undefined,
  };
  return Object.assign(quote, Object.fromEntries(Object.entries(numeric).filter(([, value]) => value !== undefined)));
}

const tradingDay = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'America/New_York', year: 'numeric', month: '2-digit', day: '2-digit',
});
const beijingDay = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Asia/Shanghai', year: 'numeric', month: '2-digit', day: '2-digit',
});
const beijingTime = new Intl.DateTimeFormat('en-GB', {
  timeZone: 'Asia/Shanghai', hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
});

function trendDay(timestamp, symbol) {
  return (symbol.endsWith('.US') ? tradingDay : beijingDay).format(timestamp);
}

function trendPoint(row, symbol) {
  const v = toNumber(row.price ?? row.close);
  if (v === undefined) return null;
  return {
    day: trendDay(row.timestamp, symbol), t: beijingTime.format(row.timestamp), v,
    vol: toNumber(row.volume), avg: toNumber(row.avgPrice),
  };
}

function noQuote(error) {
  // The N-API SDK may include the business code in the error message.
  return /\b30160[23]\b/.test(String(error?.code ?? '') + ' ' + String(error?.message ?? ''));
}

async function historicalPoints(context, symbol) {
  const rows = new Map();
  let end;
  // Each history request returns at most 1000 minutes. Overlap the boundary
  // session so a partially returned session is completed on the next page.
  for (let page = 0; page < 4; page += 1) {
    const bars = await context.historyCandlesticksByDate(
      symbol, Period.Min_1, AdjustType.NoAdjust, null, end, TradeSessions.Intraday,
    );
    if (bars.length === 0) break;
    for (const row of bars) rows.set(row.timestamp.getTime(), row);
    const days = [...new Set([...rows.values()].map((row) => trendDay(row.timestamp, symbol)))].sort();
    if (days.length > 5 || bars.length < 1000) break;
    const [year, month, day] = days[0].split('-').map(Number);
    const next = new NaiveDate(year, month, day);
    if (String(next) === String(end)) break;
    end = next;
  }
  const sorted = [...rows.values()].sort((left, right) => left.timestamp - right.timestamp);
  const days = [...new Set(sorted.map((row) => trendDay(row.timestamp, symbol)))].slice(-5);
  return sorted.filter((row) => days.includes(trendDay(row.timestamp, symbol)));
}

export function createMarketData(getContext = createQuoteContext()) {
  const metadata = new Map();
  const trends = new Map();
  const lifetime = 60_000;
  let baseCatalog;
  const listings = new Map();

  async function fetchQuotes(inputs, { signal } = {}) {
    signal?.throwIfAborted();
    const list = (Array.isArray(inputs) ? inputs : [inputs]).filter((input) => typeof input === 'string' && input.trim()).map((input) => input.trim());
    const plans = list.map(candidateSymbols);
    const symbols = [...new Set(plans.flat())];
    const rows = new Map();
    if (symbols.length > 0) {
      const ctx = await getContext();
      for (let start = 0; start < symbols.length; start += 500) {
        signal?.throwIfAborted();
        const batch = symbols.slice(start, start + 500);
        for (const row of await ctx.quote(batch)) rows.set(row.symbol, row);
        const missing = batch.filter((symbol) => rows.has(symbol) && !metadata.has(symbol));
        if (missing.length) {
          // Prices remain available even if optional names and share counts fail.
          try {
            for (const info of await ctx.staticInfo(missing)) metadata.set(info.symbol, info);
          } catch {
            // The next quote can retry static data.
          }
        }
      }
    }
    signal?.throwIfAborted();
    const quotes = [];
    const unresolved = [];
    for (const [index, spelling] of list.entries()) {
      const symbol = plans[index].find((candidate) => rows.has(candidate));
      if (symbol === undefined) unresolved.push(spelling);
      else quotes.push(normalizeQuote(rows.get(symbol), metadata.get(symbol), spelling));
    }
    return { quotes, unresolved, asOf: new Date().toISOString() };
  }

  async function fetchTrend(input, days) {
    for (const symbol of candidateSymbols(input)) {
      const key = symbol + ':' + days;
      let entry = trends.get(key);
      if (!entry || Date.now() - entry.at >= lifetime) {
        if (trends.size >= 512) trends.delete(trends.keys().next().value);
        entry = {
          at: Date.now(),
          points: (async () => {
            const ctx = await getContext();
            try {
              const rows = days === 5 ? await historicalPoints(ctx, symbol) : await ctx.intraday(symbol, TradeSessions.Intraday);
              return rows.map((row) => trendPoint(row, symbol)).filter(Boolean);
            } catch (error) {
              if (noQuote(error)) return [];
              throw error;
            }
          })(),
        };
        trends.set(key, entry);
      }
      try {
        const points = await entry.points;
        if (points.length > 0) return points;
      } catch (error) {
        if (trends.get(key) === entry) trends.delete(key);
        throw error;
      }
    }
    return [];
  }

  function marketListing(market) {
    const cached = listings.get(market);
    if (cached && cached.expires > Date.now()) return cached.entries;

    const item = { expires: Date.now() + 60_000 };
    item.entries = (async () => {
      const context = await getContext();
      const rows = await context.securityList(market);
      if (rows.length > 0) item.expires = Date.now() + 86_400_000;
      return rows.flatMap(({ symbol, nameCn, nameEn, nameHk }) => {
        const names = [...new Set([nameCn, nameEn, nameHk].filter(Boolean))];
        return (names.length ? names : [symbol]).map((name) => [name, symbol]);
      });
    })().catch((error) => {
      if (error instanceof AuthorizationRequired && listings.get(market) === item) listings.delete(market);
      return cached?.entries ?? [];
    });
    listings.set(market, item);
    return item.entries;
  }

  async function fetchCatalog() {
    baseCatalog ??= readFile(new URL('./data/securities.json', import.meta.url), 'utf8').then((json) =>
      JSON.parse(json).entries.flatMap(([name, code]) => {
        const offlineBeijing = /^sz([48]\d{5}|92\d{4})$/i.exec(code);
        const [symbol] = candidateSymbols(offlineBeijing ? offlineBeijing[1] + '.BJ' : code);
        return symbol === undefined ? [] : [[name, symbol]];
      }),
    );
    const [base, us, hk, cn] = await Promise.all([
      baseCatalog, marketListing(Market.US), marketListing(Market.HK), marketListing(Market.CN),
    ]);
    const entries = [
      ['纳斯达克综合指数', '.IXIC.US'], ['NASDAQ Composite Index', '.IXIC.US'],
      ['纳斯达克100指数', '.NDX.US'], ['NASDAQ 100 Index', '.NDX.US'],
      ['上证指数', '000001.SH'], ['深证成指', '399001.SZ'], ['科创50', '000688.SH'],
      ...us, ...hk, ...cn, ...base,
    ];
    return {
      entries: [...new Map(entries.map((row) => [JSON.stringify(row), row])).values()],
      complete: [us, hk, cn].every((market) => market.length > 0),
    };
  }

  return { fetchQuotes, fetchTrend, fetchCatalog };
}
