import assert from 'node:assert/strict';
import { candidateSymbols, createMarketData, formatAmount } from '../quotes.js';
import { AuthorizationRequired, createLongbridgeAuth, createQuoteContext } from '../oauth.js';
import { registerMarketRoutes } from '../market-routes.js';
import { buildToolDefinition } from '../index.js';

for (const [input, expected] of Object.entries({
  '600519': ['600519.SH', '600519.SZ'], '000001': ['000001.SZ', '000001.SH'],
  sh600519: ['600519.SH'], sz300750: ['300750.SZ'], '920001': ['920001.BJ'],
  bj430047: ['430047.BJ'], hk00700: ['700.HK'], '116.00700': ['700.HK'],
  '00700.HK': ['700.HK'], AAPL: ['AAPL.US'], '105.AAPL': ['AAPL.US'],
  'BRK.B.US': ['BRK.B.US'], '.IXIC.US': ['.IXIC.US'], IXIC: ['.IXIC.US'], '.NDX': ['.NDX.US'], BK1036: [], '90.BK1036': [], '600519.XQ': [],
})) assert.deepEqual(candidateSymbols(input), expected, input);

assert.equal(formatAmount(1e8), '1.00亿');
assert.equal(formatAmount(undefined), '—');
await assert.rejects(createQuoteContext('')(), AuthorizationRequired);

let builds = 0;
let failAuthorization;
const auth = createLongbridgeAuth('dsh-test-fixture', async (id, onUrl) => {
  assert.equal(id, 'dsh-test-fixture');
  builds++;
  return new Promise((resolve, reject) => {
    failAuthorization = reject;
    onUrl('https://openapi.longbridge.com/oauth2/authorize?state=fixture');
  });
});
assert.deepEqual(await auth.status(), { state: 'idle' });
const [login, duplicate] = await Promise.all([auth.login(), auth.login()]);
assert.deepEqual(login, duplicate);
assert.equal(login.state, 'pending');
assert.equal(builds, 1);
assert.deepEqual(await auth.status(), { state: 'pending' });
await assert.rejects(auth.getContext(), AuthorizationRequired);
failAuthorization(new Error('cancelled'));
await new Promise((resolve) => setImmediate(resolve));
assert.equal((await auth.status()).state, 'failed');

let quoteCalls = 0;
let staticCalls = 0;
let trendCalls = 0;
const data = createMarketData(async () => ({
  async quote(symbols) {
    quoteCalls++;
    assert.deepEqual(symbols, ['700.HK', 'AAPL.US']);
    return [{ symbol: '700.HK', lastDone: '400', prevClose: '390', volume: 123, turnover: '49200' }];
  },
  async staticInfo(symbols) {
    staticCalls++;
    assert.deepEqual(symbols, ['700.HK']);
    return [{ symbol: '700.HK', nameCn: '腾讯控股', totalShares: 1000 }];
  },
  async intraday(symbol, sessions) {
    assert.equal(sessions, 0);
    assert.equal(symbol, 'AAPL.US');
    trendCalls++;
    return [{ price: '200.50', timestamp: new Date('2026-11-16T21:00:00Z'), volume: 18, avgPrice: '201' }];
  },
  async securityList(market) {
    return {
      1: [{ symbol: 'AAPL.US', nameCn: '苹果', nameEn: 'Apple' }],
      2: [{ symbol: '700.HK', nameCn: '腾讯控股' }],
      3: [{ symbol: '688981.SH', nameCn: '中芯国际' }, { symbol: '000001.SZ', nameCn: '平安银行' }],
    }[market];
  },
  async historyCandlesticksByDate(symbol, period, adjust, start, end, sessions) {
    assert.equal(symbol, '700.HK');
    assert.equal(period, 1);
    assert.equal(sessions, 0);
    return [{ close: '380', timestamp: new Date('2026-11-16T02:00:00Z'), volume: 100 }];
  },
}));

const tool = buildToolDefinition([], data);
const result = await tool.execute({ symbols: ['hk00700', '700.HK', 'AAPL', 'BK1036'] });
assert.equal(result.source, '长桥 (Longbridge)');
assert.deepEqual(result.quotes.map((quote) => quote.symbol), ['hk00700', '700.HK']);
assert.deepEqual(result.unresolved, ['AAPL', 'BK1036']);
assert.equal(result.quotes[0].name, '腾讯控股');
assert.equal(result.quotes[0].change, 10);
assert.equal(result.quotes[0].changePct, 2.56410256);
assert.equal(result.quotes[0].marketCap, 400000);
await data.fetchQuotes(['hk00700', 'AAPL']);
assert.equal(quoteCalls, 2);
assert.equal(staticCalls, 1);
await assert.rejects(data.fetchQuotes(['AAPL'], { signal: AbortSignal.abort() }), { name: 'AbortError' });
assert.deepEqual(await data.fetchTrend('AAPL', 1), [{ day: '2026-11-16', t: '05:00', v: 200.5, vol: 18, avg: 201 }]);
await data.fetchTrend('AAPL.US', 1);
assert.equal(trendCalls, 1);
assert.deepEqual(await data.fetchTrend('hk00700', 5), [{ day: '2026-11-16', t: '10:00', v: 380, vol: 100, avg: undefined }]);

const handlers = new Map();
registerMarketRoutes({
  get: () => ({
    requestRejection: ({ headers }) => headers.allowed ? undefined : 401,
  }),
  effect: (callback) => callback(),
  webServer: { register: ({ path, handler }) => handlers.set(path, handler) },
}, data, auth);
async function request(path, query, allowed, method = 'GET', extraHeaders = {}) {
  const url = '/api/dsh-stock-quotes-plus/' + path;
  let status;
  let body;
  await handlers.get(url)({ url: url + query, method, headers: { allowed, ...extraHeaders } }, {
    writeHead(code) { status = code; },
    end(value) { body = JSON.parse(value); },
  });
  return { status, body };
}
assert.equal((await request('auth/login', '', false, 'POST')).status, 401);
assert.equal((await request('auth/login', '', true)).status, 405);
assert.equal((await request('auth/login', '', true, 'POST')).status, 403);
assert.equal((await request('auth/status', '', true)).body.state, 'failed');
assert.equal((await request('quotes', '?symbol=700.HK&symbol=AAPL.US', false)).status, 401);
assert.equal((await request('quotes', '?symbol=700.HK&symbol=AAPL.US', true, 'POST')).status, 405);
assert.equal((await request('quotes', '?symbol=700.HK&symbol=AAPL.US', true)).body.quotes[0].name, '腾讯控股');
assert.equal((await request('trend', '?symbol=700.HK&days=5', true)).body.points[0].v, 380);
assert.ok((await request('catalog', '', true)).body.entries.some(([, symbol]) => symbol === '700.HK'));

const search = (await request('catalog', '', true)).body;
assert.ok(search.complete);
assert.ok(search.entries.some(([name, symbol]) => name === '苹果' && symbol === 'AAPL.US'));
assert.ok(search.entries.some(([name, symbol]) => name.includes('纳斯达克') && symbol === '.IXIC.US'));
for (const symbol of ['700.HK', '688981.SH', '000001.SZ', '920799.BJ', '000001.SH', '399001.SZ']) {
  assert.ok(search.entries.some(([, code]) => code === symbol), symbol);
}
console.log('Longbridge fixtures passed: symbol migration, quote mapping, charts, permissions and same-origin routes');
