import { build } from 'esbuild';
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';
import assert from 'node:assert/strict';
await build({entryPoints:['tests/browser.ts'],outfile:'.test-output/browser.js',bundle:true,platform:'browser',format:'iife',alias:{obsidian:resolve('tests/obsidian-mock.ts'),'node:crypto':resolve('tests/browser-crypto.ts')}});
const require=createRequire(import.meta.url);
const {chromium}=require(process.env.PLAYWRIGHT_PATH||'playwright');
const browser=await chromium.launch({...(process.env.EDGE_PATH?{executablePath:process.env.EDGE_PATH}:{}),headless:true});
try{
  const page=await browser.newPage({viewport:{width:360,height:720}});const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto(pathToFileURL(resolve('tests/layout.html')).href);
  let cases=0;
  for(const width of [320,360,420])for(const zoom of [1,1.25,1.5,2])for(const tab of ['chat','practice','review']){
    await page.setViewportSize({width,height:720});
    await page.evaluate(({zoom,tab})=>{const host=document.querySelector('.workspace-leaf-content');host.style.zoom=String(zoom);host.style.height=(720/zoom)+'px';document.querySelector('.status-bar').style.zoom=String(zoom);window.fixture.plugin.data.tab=tab;window.fixture.view.render();},{zoom,tab});
    await page.waitForFunction(()=>document.querySelector('.sc-footer').getBoundingClientRect().bottom<=document.querySelector('.status-bar').getBoundingClientRect().top);
    const overflow=await page.evaluate(()=>{
      const vw=document.documentElement.clientWidth;const footer=document.querySelector('.sc-footer').getBoundingClientRect();
      const actions=document.querySelector('.sc-compose-actions');const hint=actions?.querySelector('.sc-keyhint').getBoundingClientRect();const send=actions?.querySelector('button').getBoundingClientRect();
      return {width:document.documentElement.scrollWidth>vw+1,bad:[...document.querySelectorAll('.sc-root button,.sc-root textarea,.sc-root select')].filter(el=>el.getClientRects().length).filter(el=>{const r=el.getBoundingClientRect();return r.left < -1 || r.right>vw+1;}).map(el=>el.textContent),footerBottom:footer.bottom,statusTop:document.querySelector('.status-bar').getBoundingClientRect().top,actionOverlap:!!(hint&&send&&hint.right>send.left)};
    });
    assert.equal(overflow.width,false,JSON.stringify({width,zoom,tab,overflow}));assert.deepEqual(overflow.bad,[],JSON.stringify({width,zoom,tab,overflow}));assert.ok(overflow.footerBottom<=overflow.statusTop,JSON.stringify({width,zoom,tab,overflow}));assert.equal(overflow.actionOverlap,false,JSON.stringify({width,zoom,tab,overflow}));cases++;
  }
  await page.setViewportSize({width:360,height:720});await page.evaluate(()=>{const host=document.querySelector('.workspace-leaf-content');host.style.zoom='1';host.style.height='720px';document.querySelector('.status-bar').style.zoom='1';window.fixture.plugin.data.tab='practice';window.fixture.view.render();});
  // A taller theme status bar and a hidden bar must both update without a re-render.
  await page.evaluate(()=>{document.querySelector('.status-bar').style.height='48px';});
  await page.waitForFunction(()=>getComputedStyle(document.querySelector('.sc-root')).paddingBottom==='54px');
  await page.evaluate(()=>{document.querySelector('.status-bar').style.display='none';});
  await page.waitForFunction(()=>getComputedStyle(document.querySelector('.sc-root')).paddingBottom==='0px');
  await page.evaluate(()=>{document.querySelector('.status-bar').style.display='';document.querySelector('.status-bar').style.height='27px';document.querySelector('.workspace-leaf-content').style.height='560px';});
  await page.waitForFunction(()=>getComputedStyle(document.querySelector('.sc-root')).paddingBottom==='0px');
  await page.evaluate(()=>{document.querySelector('.workspace-leaf-content').style.height='720px';});
  await page.waitForFunction(()=>getComputedStyle(document.querySelector('.sc-root')).paddingBottom==='33px');
  await page.getByRole('button',{name:'开始',exact:true}).first().click();
  await page.getByLabel('我的思路或作答').fill('先用乘积求导，再用链式法则');
  await page.getByRole('button',{name:'给一点提示',exact:true}).click();
  await page.getByRole('button',{name:'复习',exact:true}).click();await page.getByRole('button',{name:'练习',exact:true}).click();
  assert.equal(await page.getByLabel('我的思路或作答').inputValue(),'先用乘积求导，再用链式法则');
  await page.getByRole('button',{name:'提交尝试',exact:true}).click();await page.waitForTimeout(30);
  assert.equal(await page.getByLabel('我的思路或作答').isDisabled(),true);
  await page.getByRole('button',{name:'查看参考解答',exact:true}).click();
  await page.getByRole('button',{name:'核对正确',exact:true}).click();
  const evidence=await page.evaluate(()=>window.fixture.plugin.events);
  assert.equal(evidence[0].data.hints,1);assert.equal(evidence[0].data.solutionSeen,false);assert.equal(evidence[1].data.verdict,'correct');
  await page.getByRole('button',{name:'聊天',exact:true}).click();
  const readingArea=await page.evaluate(()=>({body:document.querySelector('.sc-body').clientHeight,root:document.querySelector('.sc-root').clientHeight}));
  assert.ok(readingArea.body/readingArea.root>=0.70,JSON.stringify(readingArea));
  const composer=page.getByLabel('发送消息',{exact:true});
  const emptyHeight=(await composer.boundingBox()).height;
  await composer.fill('第一步为什么这样做？\n第二步需要什么条件？\n第三步有没有反例？\n第四步怎样检查结果？\n补充我的思路');
  const longHeight=(await composer.boundingBox()).height;
  assert.ok(longHeight>emptyHeight&&longHeight<=121,JSON.stringify({emptyHeight,longHeight}));
  await page.getByRole('button',{name:'复习',exact:true}).click();await page.getByRole('button',{name:'聊天',exact:true}).click();
  assert.ok((await composer.inputValue()).includes('补充我的思路'));
  await composer.fill('');assert.equal((await composer.boundingBox()).height,emptyHeight);
  // Moved actions stay reachable through the menu, including keyboard opening.
  await page.getByRole('button',{name:'更多操作',exact:true}).focus();await page.keyboard.press('Enter');
  assert.equal(await page.getByRole('menuitem',{name:'连接 ChatGPT / Codex',exact:true}).count(),1);
  assert.equal(await page.getByRole('menuitem',{name:'复制问题与上下文到 ChatGPT / Codex',exact:true}).count(),1);
  await page.getByRole('menuitem',{name:'更新为当前笔记 / 选区',exact:true}).click();
  assert.equal(await page.locator('.sc-understanding').count(),0);
  assert.equal(await page.getByText('记下我的理解',{exact:true}).count(),0);
  assert.equal(await page.locator('.sc-message-user').count(),1);
  assert.equal(await page.locator('.sc-message-assistant').count(),1);
  await page.evaluate(()=>Object.defineProperty(navigator,'clipboard',{configurable:true,value:{writeText:async text=>{window.copiedAnswer=text;}}}));
  await page.getByRole('button',{name:'复制回答',exact:true}).click();
  assert.equal(await page.evaluate(()=>window.copiedAnswer),await page.evaluate(()=>window.fixture.plugin.session().messages[1].text));
  await page.screenshot({path:'.test-output/plugin-chat-360.png',fullPage:true});
  // Streaming growth follows the bottom, but must not drag a reader out of history.
  await page.evaluate(()=>{const p=document.createElement('p');p.textContent='这是持续追加的回答。'.repeat(300);document.querySelector('.sc-message-assistant .sc-markdown').append(p);});
  await page.waitForFunction(()=>{const b=document.querySelector('.sc-body');return b.scrollHeight-b.scrollTop-b.clientHeight<2;});
  await page.evaluate(()=>{const b=document.querySelector('.sc-body');b.scrollTop=0;b.dispatchEvent(new Event('scroll'));const p=document.createElement('p');p.textContent='新的回答内容。'.repeat(100);document.querySelector('.sc-message-assistant .sc-markdown').append(p);});
  await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
  assert.equal(await page.locator('.sc-body').evaluate(e=>e.scrollTop),0);
  // IME Enter is not a send; Shift+Enter inserts a line, Enter sends once.
  await composer.fill('继续说明');
  await composer.evaluate(e=>e.dispatchEvent(new KeyboardEvent('keydown',{key:'Enter',isComposing:true,bubbles:true,cancelable:true})));
  assert.equal(await page.evaluate(()=>window.fixture.plugin.session().messages.length),2);
  await composer.press('Shift+Enter');assert.equal(await composer.inputValue(),'继续说明\n');
  await composer.press('Enter');
  await page.waitForFunction(()=>window.fixture.plugin.session().messages.length===4&&!window.fixture.plugin.busy);
  assert.equal(await composer.inputValue(),'');
  assert.equal(await composer.evaluate(e=>e===document.activeElement),true);
  assert.equal(await page.locator('.sc-message-assistant .sc-markdown').last().textContent(),'模型回答');
  await page.evaluate(()=>{document.documentElement.style.setProperty('--text-normal','#e6e3ec');document.documentElement.style.setProperty('--text-muted','#aaa4b3');document.documentElement.style.setProperty('--text-accent','#b398ef');document.documentElement.style.setProperty('--background-primary','#202020');document.documentElement.style.setProperty('--background-secondary','#272729');document.documentElement.style.setProperty('--background-modifier-border','#3a363f');document.documentElement.style.setProperty('--background-modifier-hover','#363044');document.documentElement.style.colorScheme='dark';});
  await page.getByRole('button',{name:'复习',exact:true}).click();await page.screenshot({path:'.test-output/plugin-review-dark.png',fullPage:true});
  assert.deepEqual(errors,[]);console.log(JSON.stringify({cases,errors,readingArea,composer:{emptyHeight,longHeight},interaction:'chat Enter/Shift+Enter and IME guard; copy Markdown; stream follows unless reading history; draft and composer focus preserved; no understanding form; original assistance snapshot unchanged'}));
}finally{await browser.close();}
