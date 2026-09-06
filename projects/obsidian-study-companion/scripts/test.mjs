import { build } from 'esbuild';
import { readdirSync, mkdirSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { resolve } from 'node:path';
const files=readdirSync('tests').filter(name=>name.endsWith('.test.ts'));
mkdirSync('.test-output',{recursive:true});
for(const file of files)await build({entryPoints:['tests/'+file],outfile:'.test-output/'+file.replace(/\.ts$/,'.cjs'),bundle:true,platform:'node',format:'cjs',target:'es2022',logLevel:'silent',alias:{obsidian:resolve('tests/vault-mock.ts')}});
const result=spawnSync(process.execPath,['--test',...files.map(file=>'.test-output/'+file.replace(/\.ts$/,'.cjs'))],{stdio:'inherit',windowsHide:true});
process.exitCode=result.status??1;
