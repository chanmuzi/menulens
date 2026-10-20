import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import { devApi } from './vite-plugin-dev-api';

/** 빌드마다 바뀌는 id. 앱은 /version.json 과 비교해 새 빌드면 스스로 새로고침한다 (iOS 홈 화면 앱의 오래된 캐시 대응). */
const BUILD_ID = Date.now().toString(36);

const versionFile = (): Plugin => ({
  name: 'menulens-version',
  generateBundle() {
    this.emitFile({ type: 'asset', fileName: 'version.json', source: JSON.stringify({ id: BUILD_ID }) });
  },
  configureServer(server) {
    server.middlewares.use((req, res, next) => {
      if (req.url?.split('?')[0] !== '/version.json') return next();
      res.setHeader('content-type', 'application/json');
      res.setHeader('cache-control', 'no-store');
      res.end(JSON.stringify({ id: BUILD_ID }));
    });
  },
});

export default defineConfig({
  define: { __BUILD_ID__: JSON.stringify(BUILD_ID) },
  plugins: [react(), devApi(), versionFile()],
  server: { host: true, port: 5173 },
});
