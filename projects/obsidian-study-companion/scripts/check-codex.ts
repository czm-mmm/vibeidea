import { CodexBridge } from '../src/codex';
const binary=process.argv[2]||'codex';
const bridge=new CodexBridge(binary);
(async()=>{try {
  const account=await bridge.connect();
  console.log(JSON.stringify({protocol:'initialized',chatgpt:account.connected,plan:account.plan||null}));
  if(process.argv.includes('--ask')&&account.connected){const answer=await bridge.answer('用一句中文解释为什么 x² 的导数是 2x。不要调用任何工具。');console.log(JSON.stringify({reply:answer}));}
} finally {await bridge.dispose();}})().catch(error=>{console.error(error.message);process.exitCode=1;});
