import { AdjustType, Market, NaiveDate, Period, TradeSessions } from 'longbridge';
import { readFile } from 'node:fs/promises';
import { AuthorizationRequired, createQuoteContext } from './oauth.js';
import { createMarketCalendar, marketOf } from './market-calendar.js';

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
  if (!(v > 0)) return null;
  const average = toNumber(row.avgPrice);
  return {
    day: trendDay(row.timestamp, symbol), t: beijingTime.format(row.timestamp), v,
    vol: toNumber(row.volume), avg: average > 0 ? average : undefined,
  };
}

function dayPoint(row, symbol) {
  if (!(row.timestamp instanceof Date) || !Number.isFinite(row.timestamp.getTime())) return null;
  const point = trendPoint(row, symbol);
  return point && { ...point, minute: Math.floor(row.timestamp.getTime() / 60_000) };
}

function mergeDayPoints(series, points) {
  for (const point of points) {
    if (point.day < series.day) continue;
    if (point.day > series.day) {
      series.day = point.day;
      series.points.clear();
    }
    const previous = series.points.get(point.minute);
    series.points.set(point.minute, {
      ...point,
      avg: point.avg ?? previous?.avg,
      vol: point.vol ?? previous?.vol,
    });
  }
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

export function createMarketData(getContext = createQuoteContext(), closedKey = createMarketCalendar(getContext)) {
  const metadata = new Map();
  const quoteCache = new Map();
  const pendingQuotes = new Map();
  const trends = new Map();
  const daily = new Map();
  let baseCatalog;
  const listings = new Map();

  function dailyEntry(symbol) {
    let entry = daily.get(symbol);
    if (!entry) {
      if (daily.size >= 4096) daily.delete(daily.keys().next().value);
      entry = { day: '', points: new Map(), seeded: false };
      daily.set(symbol, entry);
    }
    return entry;
  }

  function recordDailyQuote(row) {
    if (!row) return;
    const point = dayPoint({ price: row.lastDone, timestamp: row.timestamp }, row.symbol);
    if (!point) return;
    const entry = dailyEntry(row.symbol);
    const timestamp = row.timestamp.getTime();
    if (timestamp < (entry.latestTimestamp ?? 0)) return;
    entry.latestTimestamp = timestamp;
    entry.latest = point;
    mergeDayPoints(entry, [point]);
  }

  async function fetchDaily(symbol) {
    const entry = dailyEntry(symbol);
    if (!entry.seeded) {
      entry.pending ??= (async () => {
        const ctx = await getContext();
        let rows = [];
        try {
          rows = await ctx.intraday(symbol, TradeSessions.Intraday);
        } catch (error) {
          if (!noQuote(error)) throw error;
        }
        // Preserve quotes already collected while the historical seed was loading.
        const live = [...entry.points.values()];
        entry.points.clear();
        entry.day = '';
        mergeDayPoints(entry, rows.map((row) => dayPoint(row, symbol)).filter(Boolean));
        mergeDayPoints(entry, live);
        entry.seeded = true;
      })().finally(() => { entry.pending = undefined; });
      await entry.pending;
    }
    return [...entry.points.values()].sort((a, b) => a.minute - b.minute);
  }

  function loadQuoteBatch(symbols, phases) {
    const batch = (async () => {
      const ctx = await getContext();
      const rows = new Map((await ctx.quote(symbols)).map((row) => [row.symbol, row]));
      const at = Date.now();
      for (const row of rows.values()) recordDailyQuote(row);
      const missing = symbols.filter((symbol) => rows.has(symbol) && !metadata.has(symbol));
      if (missing.length > 0) {
        try {
          for (const info of await ctx.staticInfo(missing)) metadata.set(info.symbol, info);
        } catch {
          // A metadata failure does not make the quote unusable.
        }
      }
      for (const symbol of symbols) {
        if (quoteCache.size >= 4096 && !quoteCache.has(symbol)) quoteCache.delete(quoteCache.keys().next().value);
        quoteCache.set(symbol, { row: rows.get(symbol), at, phase: phases.get(marketOf(symbol)) });
      }
      return { rows, at };
    })().finally(() => {
      for (const symbol of symbols) pendingQuotes.delete(symbol);
    });
    for (const symbol of symbols) pendingQuotes.set(symbol, batch);
    return batch;
  }

  async function fetchQuotes(inputs, { signal, includeIntraday = false } = {}) {
    signal?.throwIfAborted();
    const list = (Array.isArray(inputs) ? inputs : [inputs]).filter((input) => typeof input === 'string' && input.trim()).map((input) => input.trim());
    const plans = list.map(candidateSymbols);
    const symbols = [...new Set(plans.flat())];
    const rows = new Map();
    const pending = new Map();
    const missing = [];
    const now = Date.now();
    const markets = [...new Set(symbols.map(marketOf))];
    const phases = new Map(await Promise.all(markets.map(async (market) => [market, await closedKey(market, now)])));
    signal?.throwIfAborted();
    for (const symbol of symbols) {
      const cached = quoteCache.get(symbol);
      const phase = phases.get(marketOf(symbol));
      if (cached && cached.phase === phase && (phase !== undefined || now - cached.at < (cached.row ? 2_000 : 30_000))) {
        rows.set(symbol, cached);
      }
      else if (pendingQuotes.has(symbol)) pending.set(symbol, pendingQuotes.get(symbol));
      else missing.push(symbol);
    }
    for (let start = 0; start < missing.length; start += 500) {
      const symbols = missing.slice(start, start + 500);
      const batch = loadQuoteBatch(symbols, phases);
      for (const symbol of symbols) pending.set(symbol, batch);
    }
    await Promise.all([...pending].map(async ([symbol, batch]) => {
      const { rows: batchRows, at } = await batch;
      rows.set(symbol, { row: batchRows.get(symbol), at });
    }));
    signal?.throwIfAborted();
    const quotes = [];
    const unresolved = [];
    const intraday = [];
    let asOf = Infinity;
    for (const [index, spelling] of list.entries()) {
      const symbol = plans[index].find((candidate) => rows.get(candidate)?.row);
      if (symbol === undefined) unresolved.push(spelling);
      else {
        const { row, at } = rows.get(symbol);
        quotes.push(normalizeQuote(row, metadata.get(symbol), spelling));
        const point = includeIntraday ? daily.get(symbol)?.latest : undefined;
        if (point) intraday.push({ symbol: spelling, point });
        asOf = Math.min(asOf, at);
      }
    }
    return { quotes, unresolved, asOf: new Date(asOf === Infinity ? Date.now() : asOf).toISOString(), ...(includeIntraday ? { intraday } : {}) };
  }

  async function fetchTrend(input, days) {
    const symbols = candidateSymbols(input);
    if (days !== 5) {
      for (const symbol of symbols) {
        const points = await fetchDaily(symbol);
        if (points.length > 0) return points;
      }
      return [];
    }
    const lifetime = 300_000;
    const phases = new Map();
    for (const symbol of symbols) {
      const market = marketOf(symbol);
      if (!phases.has(market)) phases.set(market, await closedKey(market));
      const phase = phases.get(market);
      const key = symbol + ':' + days;
      let entry = trends.get(key);
      if (!entry || (entry.at !== undefined && (entry.phase !== phase || (phase === undefined && Date.now() - entry.at >= lifetime)))) {
        if (trends.size >= 512) trends.delete(trends.keys().next().value);
        entry = {
          at: undefined,
          phase,
          points: (async () => {
            const ctx = await getContext();
            try {
              const rows = await historicalPoints(ctx, symbol);
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
        entry.at ??= Date.now();
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
