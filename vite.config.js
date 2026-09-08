import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import fs from 'node:fs'
import path from 'node:path'

function binaryServePlugin() {
  const handler = (req, res, next) => {
    if (req.url && (req.url === '/My3DCube.apk' || req.url.startsWith('/My3DCube.apk?'))) {
      const candidates = [
        path.resolve('dist/My3DCube.apk'),
        path.resolve('public/My3DCube.apk')
      ];
      for (const filePath of candidates) {
        if (fs.existsSync(filePath)) {
          const stat = fs.statSync(filePath);
          res.writeHead(200, {
            'Content-Type': 'application/vnd.android.package-archive',
            'Content-Disposition': 'attachment; filename="My3DCube.apk"',
            'Content-Length': stat.size,
            'Cache-Control': 'no-cache'
          });
          return fs.createReadStream(filePath).pipe(res);
        }
      }
    }
    if (req.url && (req.url === '/My3DCubeWallpaper.exe' || req.url.startsWith('/My3DCubeWallpaper.exe?'))) {
      const candidates = [
        path.resolve('dist/My3DCubeWallpaper.exe'),
        path.resolve('public/My3DCubeWallpaper.exe')
      ];
      for (const filePath of candidates) {
        if (fs.existsSync(filePath)) {
          const stat = fs.statSync(filePath);
          res.writeHead(200, {
            'Content-Type': 'application/vnd.microsoft.portable-executable',
            'Content-Disposition': 'attachment; filename="My3DCubeWallpaper.exe"',
            'Content-Length': stat.size,
            'Cache-Control': 'no-cache'
          });
          return fs.createReadStream(filePath).pipe(res);
        }
      }
    }
    next();
  };

  return {
    name: 'binary-serve-plugin',
    configureServer(server) {
      server.middlewares.use(handler);
    },
    configurePreviewServer(server) {
      server.middlewares.use(handler);
    }
  };
}

function getHttpsConfig() {
  const certPath = process.env.SSL_CERT_PATH || '/etc/letsencrypt/live/therealbonz.com/fullchain.pem';
  const keyPath = process.env.SSL_KEY_PATH || '/etc/letsencrypt/live/therealbonz.com/privkey.pem';

  try {
    if (fs.existsSync(certPath) && fs.existsSync(keyPath)) {
      return {
        cert: fs.readFileSync(certPath),
        key: fs.readFileSync(keyPath),
      };
    }
  } catch (err) {
    console.warn(`[Vite SSL] Certificates located at ${certPath} but cannot be read (${err.message}). Defaulting to HTTP.`);
  }
  return undefined;
}

const httpsConfig = getHttpsConfig();

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react(), binaryServePlugin()],
  server: {
    port: 5173,
    host: true,
    https: httpsConfig,
    hmr: httpsConfig ? {
      protocol: 'wss',
      host: 'therealbonz.com',
      clientPort: 5173,
    } : undefined,
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:3000',
        changeOrigin: true,
        secure: false,
      },
      '/rails': {
        target: 'http://127.0.0.1:3000',
        changeOrigin: true,
        secure: false,
      }
    }
  },
  preview: {
    port: 5173,
    host: true,
    allowedHosts: ['therealbonz.com'],
    https: httpsConfig,
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:3000',
        changeOrigin: true,
        secure: false,
      },
      '/rails': {
        target: 'http://127.0.0.1:3000',
        changeOrigin: true,
        secure: false,
      }
    }
  }
})

