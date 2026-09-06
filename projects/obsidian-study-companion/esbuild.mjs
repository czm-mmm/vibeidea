import * as esbuild from 'esbuild';
import { mkdir, copyFile } from 'node:fs/promises';
const ctx = await esbuild.context({
  entryPoints: ['src/main.ts'], outfile: 'dist/study-companion/main.js', bundle: true,
  platform: 'node', format: 'cjs', target: 'es2022', external: ['obsidian', 'electron'],
  sourcemap: false, logLevel: 'info'
});
await mkdir('dist/study-companion', { recursive: true });
for (const file of ['manifest.json', 'styles.css']) await copyFile(file, 'dist/study-companion/' + file);
if (process.argv.includes('--watch')) await ctx.watch();
else { await ctx.rebuild(); await ctx.dispose(); }
