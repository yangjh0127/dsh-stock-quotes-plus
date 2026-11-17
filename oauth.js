import { randomUUID } from 'node:crypto';
import { access, mkdir, readFile, rename, rm, writeFile } from 'node:fs/promises';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';
import { Config, OAuth, QuoteContext, QuoteTransport } from 'longbridge';

const OAUTH_DIR = join(homedir(), '.longbridge', 'openapi');
const CLIENT_FILE = join(OAUTH_DIR, 'dsh-stock-quotes-plus-client');
const LOGIN_ERROR = '长桥登录失败。请检查网络或稍后重试。';
const DEVICE_GRANT = 'urn:ietf:params:oauth:grant-type:device_code';
const GLOBAL_HOST = 'openapi.longbridge.com';
const CN_HOST = 'openapi.longbridge.cn';

class LoginError extends Error {}

async function oauthRequest(path, body, stage, host) {
  const region = process.env.LONGBRIDGE_REGION;
  const hosts = host ? [host] : region === 'cn' ? [CN_HOST] : region === 'global' ? [GLOBAL_HOST] : [GLOBAL_HOST, CN_HOST];
  for (const domain of hosts) {
    try {
      const response = await fetch('https://' + domain + '/oauth2/' + path, {
        method: 'POST',
        redirect: 'error',
        headers: { 'content-type': body instanceof URLSearchParams ? 'application/x-www-form-urlencoded' : 'application/json' },
        signal: AbortSignal.timeout(8000),
        body,
      });
      return { domain, response, data: await response.json().catch(() => ({})) };
    } catch {
      if (domain === hosts.at(-1)) throw new LoginError(`长桥${stage}失败（${hosts.join('、')}）：无法连接。`);
    }
  }
}

export class AuthorizationRequired extends Error {
  constructor() {
    super('请在 DSH 数据面板或插件设置中点击「登录长桥」。');
  }
}

function clientIdOf(value) {
  if (typeof value !== 'string' || !/^[a-z0-9_-]{1,128}$/i.test(value)) throw new AuthorizationRequired();
  return value;
}

async function storedClientId() {
  try {
    return clientIdOf((await readFile(CLIENT_FILE, 'utf8')).trim());
  } catch (error) {
    if (error.code === 'ENOENT') return undefined;
    throw error;
  }
}

async function registerClient() {
  const { domain, response, data } = await oauthRequest('register', JSON.stringify({
    redirect_uris: ['http://localhost:60355/callback'],
    token_endpoint_auth_method: 'none',
    grant_types: ['authorization_code', 'refresh_token', DEVICE_GRANT],
    response_types: ['code'],
    client_name: 'DSH Stock Quotes Plus',
  }), '客户端注册');
  if (!response.ok) throw new LoginError(`长桥客户端注册失败（${domain}，HTTP ${response.status}）。`);
  const id = clientIdOf(data.client_id);
  await mkdir(OAUTH_DIR, { recursive: true, mode: 0o700 });
  try {
    // Keep only the public client ID. Multiple DSH processes reuse the first ID.
    await writeFile(CLIENT_FILE, id, { flag: 'wx', mode: 0o600 });
  } catch (error) {
    if (error.code === 'EEXIST') return { id: clientIdOf(await storedClientId()), domain };
    throw error;
  }
  return { id, domain };
}

export async function authorize(clientId, onUrl) {
  return OAuth.build(clientIdOf(clientId), (error, url) => {
    if (!error) onUrl(url);
  });
}

function authorizationUrl(value) {
  const url = new URL(value);
  if (url.protocol !== 'https:' || !/(^|\.)longbridge\.(com|cn)$/.test(url.hostname) || url.username || url.password) {
    throw new Error('Unexpected Longbridge authorization URL');
  }
  return url.href;
}

async function deviceLogin(id, onUrl, host) {
  const { domain, response, data } = await oauthRequest('device/authorize', new URLSearchParams({ client_id: id }), '设备码申请', host);
  if ([404, 405, 501].includes(response.status) || ['unauthorized_client', 'unsupported_grant_type'].includes(data.error)) return false;
  if (!response.ok || typeof data.device_code !== 'string' || typeof data.user_code !== 'string'
      || !Number.isFinite(data.expires_in) || data.expires_in <= 0) {
    throw new LoginError(`长桥设备码申请失败（${domain}，HTTP ${response.status}）。`);
  }
  let url;
  try {
    url = authorizationUrl(data.verification_uri_complete || data.verification_uri);
  } catch {
    throw new LoginError('长桥返回了无效的设备授权链接。');
  }
  onUrl(url, data.user_code);
  const expires = Date.now() + data.expires_in * 1000;
  let interval = Number.isFinite(data.interval) && data.interval > 0 ? data.interval : 5;
  while (Date.now() + interval * 1000 < expires) {
    await delay(interval * 1000);
    const { response: poll, data: token } = await oauthRequest('token', new URLSearchParams({
      client_id: id,
      grant_type: DEVICE_GRANT,
      device_code: data.device_code,
    }), '设备授权确认', domain);
    if (poll.ok && typeof token.access_token === 'string' && token.access_token) {
      const dir = join(OAUTH_DIR, 'tokens');
      await mkdir(dir, { recursive: true, mode: 0o700 });
      const temporary = join(dir, '.' + randomUUID());
      try {
        await writeFile(temporary, JSON.stringify({
          client_id: id,
          access_token: token.access_token,
          refresh_token: token.refresh_token ?? null,
          expires_at: Math.floor(Date.now() / 1000) + (Number.isFinite(token.expires_in) ? token.expires_in : 3600),
        }), { flag: 'wx', mode: 0o600 });
        await rename(temporary, join(dir, id));
      } finally {
        await rm(temporary, { force: true });
      }
      return true;
    }
    if (token.error === 'authorization_pending') continue;
    if (token.error === 'slow_down') {
      interval += 5;
      continue;
    }
    if (token.error === 'access_denied') throw new LoginError('长桥授权已取消或拒绝，请重新登录。');
    if (token.error === 'expired_token') break;
    throw new LoginError(`长桥设备授权确认失败（${domain}，HTTP ${poll.status}）。`);
  }
  throw new LoginError('长桥设备码已过期，请重新登录。');
}

async function hasToken(id) {
  if (id === undefined) return false;
  try {
    await access(join(OAUTH_DIR, 'tokens', id));
    return true;
  } catch {
    return false;
  }
}

export function createLongbridgeAuth(configuredId = process.env.LONGBRIDGE_CLIENT_ID, build = authorize) {
  let context;
  let operation;
  let failure;
  const clientId = async () => configuredId === undefined ? storedClientId() : clientIdOf(configuredId);

  function start(interactive) {
    const attempt = { url: undefined };
    if (interactive) failure = undefined;
    attempt.ready = new Promise((resolve) => {
      attempt.result = (async () => {
        let id = await clientId();
        let domain;
        if (interactive && id === undefined) ({ id, domain } = await registerClient());
        const saved = await hasToken(id);
        if (!id || (!interactive && !saved)) throw new AuthorizationRequired();
        const onUrl = (url, userCode) => {
          try {
            attempt.url = authorizationUrl(url);
            attempt.userCode = userCode;
          } catch {
            attempt.invalidUrl = true;
          }
          resolve();
        };
        if (interactive && !saved && build === authorize) await deviceLogin(id, onUrl, domain);
        const oauth = await build(id, onUrl);
        context = QuoteContext.new(Config.fromOAuth(oauth, {
          quoteTransport: QuoteTransport.Http,
          enablePrintQuotePackages: false,
        }));
        return context;
      })().catch((error) => {
        if (interactive || !(error instanceof AuthorizationRequired)) failure = error instanceof LoginError ? error.message : LOGIN_ERROR;
        throw error;
      }).finally(() => {
        if (operation === attempt) operation = undefined;
        resolve();
      });
      // A UI-started attempt may settle before any quote request subscribes.
      void attempt.result.catch(() => {});
    });
    operation = attempt;
    return attempt;
  }

  async function getContext() {
    if (context) return context;
    const attempt = operation ?? start(false);
    await attempt.ready;
    if (attempt.url || attempt.invalidUrl) throw new AuthorizationRequired();
    return attempt.result;
  }

  async function status() {
    if (context) return { state: 'connected' };
    if (operation?.url) return { state: 'pending' };
    if (failure) return { state: 'failed', error: failure };
    return { state: await hasToken(await clientId()) ? 'saved' : 'idle' };
  }

  async function login() {
    if (context) return { state: 'connected' };
    const attempt = operation ?? start(true);
    await attempt.ready;
    if (attempt.url && operation === attempt) {
      return { state: 'pending', url: attempt.url, ...(attempt.userCode ? { userCode: attempt.userCode } : {}) };
    }
    if (context) return { state: 'connected' };
    if (!failure && !attempt.invalidUrl && operation !== attempt) return login();
    return { state: 'failed', error: failure ?? LOGIN_ERROR };
  }

  return { getContext, status, login };
}

export function createQuoteContext(clientId) {
  return createLongbridgeAuth(clientId).getContext;
}
