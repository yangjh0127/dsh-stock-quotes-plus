import { access, mkdir, readFile, writeFile } from 'node:fs/promises';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { Config, OAuth, QuoteContext, QuoteTransport } from 'longbridge';

const OAUTH_DIR = join(homedir(), '.longbridge', 'openapi');
const CLIENT_FILE = join(OAUTH_DIR, 'dsh-stock-quotes-plus-client');
const LOGIN_ERROR = '长桥登录失败。请检查网络或稍后重试。';

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
  const domain = process.env.LONGBRIDGE_REGION === 'cn' ? 'openapi.longbridge.cn' : 'openapi.longbridge.com';
  const response = await fetch('https://' + domain + '/oauth2/register', {
    method: 'POST',
    redirect: 'error',
    headers: { 'content-type': 'application/json' },
    signal: AbortSignal.timeout(15000),
    body: JSON.stringify({
      redirect_uris: ['http://localhost:60355/callback'],
      token_endpoint_auth_method: 'none',
      grant_types: ['authorization_code', 'refresh_token'],
      response_types: ['code'],
      client_name: 'DSH Stock Quotes Plus',
    }),
  });
  if (!response.ok) throw new Error('Longbridge OAuth client registration failed');
  const id = clientIdOf((await response.json()).client_id);
  await mkdir(OAUTH_DIR, { recursive: true, mode: 0o700 });
  try {
    // Keep only the public client ID. Multiple DSH processes reuse the first ID.
    await writeFile(CLIENT_FILE, id, { flag: 'wx', mode: 0o600 });
  } catch (error) {
    if (error.code === 'EEXIST') return clientIdOf(await storedClientId());
    throw error;
  }
  return id;
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
  let failed = false;
  const clientId = async () => configuredId === undefined ? storedClientId() : clientIdOf(configuredId);

  function start(interactive) {
    const attempt = { url: undefined };
    if (interactive) failed = false;
    attempt.ready = new Promise((resolve) => {
      attempt.result = (async () => {
        let id = await clientId();
        if (interactive && id === undefined) id = await registerClient();
        if (!id || (!interactive && !await hasToken(id))) throw new AuthorizationRequired();
        const oauth = await build(id, (url) => {
          try {
            attempt.url = authorizationUrl(url);
          } catch {
            attempt.invalidUrl = true;
          }
          resolve();
        });
        context = QuoteContext.new(Config.fromOAuth(oauth, {
          quoteTransport: QuoteTransport.Http,
          enablePrintQuotePackages: false,
        }));
        return context;
      })().catch((error) => {
        if (interactive || !(error instanceof AuthorizationRequired)) failed = true;
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
    if (failed) return { state: 'failed', error: LOGIN_ERROR };
    return { state: await hasToken(await clientId()) ? 'saved' : 'idle' };
  }

  async function login() {
    if (context) return { state: 'connected' };
    const attempt = operation ?? start(true);
    await attempt.ready;
    if (attempt.url && operation === attempt) return { state: 'pending', url: attempt.url };
    if (context) return { state: 'connected' };
    if (!failed && !attempt.invalidUrl && operation !== attempt) return login();
    return { state: 'failed', error: LOGIN_ERROR };
  }

  return { getContext, status, login };
}

export function createQuoteContext(clientId) {
  return createLongbridgeAuth(clientId).getContext;
}
