import { authorize } from '../oauth.js';

try {
  await authorize(process.argv[2] ?? process.env.LONGBRIDGE_CLIENT_ID, (url) => {
    console.log('请在浏览器打开长桥授权地址：');
    console.log(url);
  });
  console.log('长桥 OAuth 授权已保存。使用相同的 Client ID 启动 DSH。');
} catch (error) {
  console.error(error instanceof Error ? error.message : '长桥 OAuth 授权失败。');
  process.exitCode = 1;
}
