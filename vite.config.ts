import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import fs from 'node:fs';
import path from 'node:path';
import { parse } from 'yaml';
import { fileURLToPath, URL } from 'node:url';

// Static site. Everything course-specific is read from course.yml / src/generated/*
// (produced by scripts/build-content.ts). This plugin only fills <head>.
interface HeadConfig {
  app: { name: string; short_name: string; script: string; theme: { primary: string; accent: string } };
  publish?: { noindex?: boolean };
}

function courseHead(): Plugin {
  let base = '/';
  return {
    name: 'course-head',
    configResolved(c) { base = c.base; },
    transformIndexHtml(html) {
      // Prefer the course the content was built from (kit / fixtures use --course), else course.yml.
      const generated = path.resolve(__dirname, 'src/generated/content.json');
      const course = fs.existsSync(generated)
        ? (JSON.parse(fs.readFileSync(generated, 'utf8')) as { course: HeadConfig }).course
        : (parse(fs.readFileSync(path.resolve(__dirname, 'course.yml'), 'utf8')) as HeadConfig);
      const { name, script, theme } = course.app;
      const noindex = course.publish?.noindex ?? true;
      // Favicon: rounded square in primary with a ring in accent (the progress motif). No file needed.
      const svg = `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 64 64'><rect width='64' height='64' rx='14' fill='${theme.primary}'/><circle cx='32' cy='32' r='15' fill='none' stroke='${theme.accent}' stroke-width='7'/></svg>`;
      const fonts: Record<string, string> = {
        hanzi: 'https://fonts.googleapis.com/css2?family=Noto+Sans+SC:wght@400;600&display=swap',
        kana: 'https://fonts.googleapis.com/css2?family=Noto+Sans+JP:wght@400;600&display=swap',
      };
      const tags = [
        noindex ? '<meta name="robots" content="noindex" />' : '',
        `<meta name="theme-color" content="${theme.primary}" />`,
        `<link rel="icon" href="data:image/svg+xml,${encodeURIComponent(svg)}" />`,
        // Home-screen install (iOS reads these tags; Android reads the manifest).
        `<link rel="apple-touch-icon" href="${base}_img/app-icon-180.png" />`,
        `<meta name="apple-mobile-web-app-capable" content="yes" />`,
        `<meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />`,
        `<meta name="apple-mobile-web-app-title" content="${course.app.short_name}" />`,
        `<link rel="manifest" href="${base}manifest.webmanifest" />`,
        fonts[script] ? `<link rel="stylesheet" href="${fonts[script]}" />` : '',
      ].filter(Boolean).join('\n    ');
      return html.replace('<!--app-head-->', tags).replace('<title>Weekly Recap</title>', `<title>${name}</title>`);
    },
  };
}

export default defineConfig({
  plugins: [react(), courseHead()],
  resolve: { alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) } },
  build: { outDir: 'dist', sourcemap: false },
  server: { port: 5173 },
});
