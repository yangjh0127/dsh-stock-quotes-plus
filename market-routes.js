import { AuthorizationRequired } from './oauth.js';

const BASE = '/api/dsh-stock-quotes-plus';

function send(response, status, data) {
  response.writeHead(status, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' });
  response.end(JSON.stringify(data));
}

export function registerMarketRoutes(ctx, data, auth) {
  const routes = {
    quotes: (params) => data.fetchQuotes(params.getAll('symbol')),
    trend: async (params) => ({ points: await data.fetchTrend(params.get('symbol'), params.get('days') === '5' ? 5 : 1) }),
    catalog: () => data.fetchCatalog(),
  };
  if (auth) {
    routes['auth/status'] = () => auth.status();
    routes['auth/login'] = () => auth.login();
  }
  for (const [path, run] of Object.entries(routes)) {
    const method = path === 'auth/login' ? 'POST' : 'GET';
    const handler = async (request, response) => {
      const connection = ctx.get('connection');
      if (!connection) return send(response, 503, { error: 'DSH browser authentication unavailable.' });
      const rejection = connection.requestRejection({ headers: request.headers });
      if (rejection !== undefined) return send(response, rejection, { error: 'Request rejected.' });
      if (request.method !== method) return send(response, 405, { error: method + ' required.' });
      if (method === 'POST' && (!request.headers.origin || request.headers['x-dsh-longbridge-login'] !== '1')) {
        return send(response, 403, { error: 'Same-origin login request required.' });
      }
      const params = new URL(request.url, 'http://localhost').searchParams;
      const symbols = params.getAll('symbol');
      if (symbols.length > 500 || symbols.some((symbol) => symbol.length > 64)) {
        return send(response, 400, { error: 'Too many symbols or invalid symbol length.' });
      }
      try {
        send(response, 200, await run(params));
      } catch (error) {
        if (error instanceof AuthorizationRequired) return send(response, 503, { error: error.message });
        const code = /\b(?:301|401|403)\d{3}\b/.exec(String(error?.message ?? ''))?.[0];
        send(response, 502, { error: code ? '长桥行情请求失败（' + code + '）。请检查行情权限或稍后重试。' : '长桥行情请求失败。请检查网络、OAuth 授权和行情权限。' });
      }
    };
    ctx.effect(() => ctx.webServer.register({ kind: 'exact', path: BASE + '/' + path, handler }), 'longbridge ' + path);
  }
}
