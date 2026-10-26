import type {ProxyOptions} from 'vite';

const localOrigin = 'http://127.0.0.1:5173';

/** Only this Codespace's private frontend is equivalent to the local dev UI.
 * Leave every other Origin untouched so the backend rejects it as before.
 * This does not authenticate users: forwarded ports must stay Private.
 */
export function createApiProxy(codespaceName?: string): ProxyOptions {
  const previewOrigin = codespaceName && /^[a-z0-9-]+$/.test(codespaceName)
    ? `https://${codespaceName}-5173.app.github.dev`
    : undefined;
  return {
    target: 'http://127.0.0.1:8787',
    changeOrigin: true,
    configure(proxy) {
      proxy.on('proxyReq', (upstream, request) => {
        if (previewOrigin && request.headers.origin === previewOrigin) {
          upstream.setHeader('origin', localOrigin);
        }
      });
    },
  };
}
