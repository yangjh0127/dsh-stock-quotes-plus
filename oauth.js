import { access } from 'node:fs/promises';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { Config, OAuth, QuoteContext, QuoteTransport } from 'longbridge';

export class AuthorizationRequired extends Error {
  constructor() {
    super('请先配置 LONGBRIDGE_CLIENT_ID，并按 README 运行 npm run authorize 完成长桥 OAuth 授权。');
  }
}

function clientIdOf(value) {
  if (typeof value !== 'string' || !/^[a-z0-9_-]{1,128}$/i.test(value)) throw new AuthorizationRequired();
  return value;
}

export async function authorize(clientId, onUrl) {
  return OAuth.build(clientIdOf(clientId), (error, url) => {
    if (!error) onUrl(url);
  });
}

export function createQuoteContext(clientId = process.env.LONGBRIDGE_CLIENT_ID) {
  let pending;
  async function connect() {
    const id = clientIdOf(clientId);
    try {
      await access(join(homedir(), '.longbridge', 'openapi', 'tokens', id));
    } catch {
      throw new AuthorizationRequired();
    }
    // A revoked cache may require interaction again. Keep that flow in the
    // authorization command, away from a panel refresh or agent tool call.
    const oauth = await new Promise((resolve, reject) => {
      authorize(id, () => reject(new AuthorizationRequired())).then(resolve, reject);
    });
    return QuoteContext.new(Config.fromOAuth(oauth, {
      quoteTransport: QuoteTransport.Http,
      enablePrintQuotePackages: false,
    }));
  }
  return () => {
    pending ??= connect().catch((error) => {
      pending = undefined;
      throw error;
    });
    return pending;
  };
}
