import { test } from 'node:test';
import assert from 'node:assert/strict';
import { VaultStore } from '../src/storage';
import { TFile, TFolder, MarkdownView } from 'obsidian';
import { newContext, type StudyEvent } from '../src/core';
function fixture(){
  const files=new Map<string,any>();const contents=new Map<string,string>();let active:any;
  const vault={getAbstractFileByPath:(path:string)=>files.get(path),createFolder:async(path:string)=>{if(files.has(path))throw Error('exists');files.set(path,new (TFolder as any)(path));},create:async(path:string,text:string)=>{if(files.has(path))throw Error('exists');const file=new (TFile as any)(path);files.set(path,file);contents.set(path,text);return file;},read:async(file:any)=>contents.get(file.path)!,cachedRead:async(file:any)=>contents.get(file.path)!,getMarkdownFiles:()=>[...files.values()].filter(f=>f instanceof TFile),process:async(file:any,change:(s:string)=>string)=>{const next=change(contents.get(file.path)!);contents.set(file.path,next);return next;}};
  const app:any={vault,workspace:{getLeavesOfType:()=>active?[{view:active}]:[]}};
  return {store:new VaultStore(app,'学习记录/Study Companion'),vault,files,contents,setActive:(view:any)=>{active=view;}};
}
const event:StudyEvent={id:'one',type:'attempt',subject:'数学',at:'2026-09-03T08:00:00Z',data:{id:'one',questionId:'q1',subject:'数学',answer:'原始尝试',hints:1,solutionSeen:false,startedAt:'2026-09-03T07:59:00Z',submittedAt:'2026-09-03T08:00:00Z'}};
test('相同提交重试不重复计数，也不覆盖原作答',async()=>{
  const f=fixture();await f.store.append(event);await f.store.append(event);assert.equal((await f.store.load()).events.length,1);
  const changed=structuredClone(event);if(changed.type==='attempt')changed.data.answer='替换';await assert.rejects(f.store.append(changed),/冲突/);assert.equal((await f.store.load()).events[0].type,'attempt');
  assert.deepEqual((await f.store.load()).events[0],event);
});
test('预览后笔记变动，写入失败并保留笔记最新内容',async()=>{
  const f=fixture();await f.vault.create('数学.md','原笔记');const context=newContext('数学.md','数学','数学','','原笔记');f.contents.set('数学.md','用户的新笔记');await assert.rejects(f.store.appendUnderstanding(context,'我的理解'),/已有新内容/);assert.equal(f.contents.get('数学.md'),'用户的新笔记');
});
test('追加理解只追加到预览目标，不改其他文件',async()=>{
  const f=fixture();await f.vault.create('数学.md','原笔记');await f.vault.create('物理.md','物理笔记');await f.store.appendUnderstanding(newContext('数学.md','数学','数学','','原笔记'),'新理解');assert.match(f.contents.get('数学.md')!,/^原笔记\n\n## 我的理解/);assert.equal(f.contents.get('物理.md'),'物理笔记');
});
test('存在编辑器时使用未落盘的编辑内容，不覆盖缓冲区',async()=>{
  const f=fixture();const file=await f.vault.create('数学.md','旧磁盘内容');let text='编辑中的内容';const view=new (MarkdownView as any)();view.file=file;view.editor={getValue:()=>text,lastLine:()=>0,getLine:()=>text,replaceRange:(addition:string)=>{text+=addition;}};f.setActive(view);await f.store.appendUnderstanding(newContext('数学.md','数学','数学','',text),'新理解');assert.match(text,/编辑中的内容[\s\S]*新理解/);assert.equal(f.contents.get('数学.md'),'旧磁盘内容');
});
