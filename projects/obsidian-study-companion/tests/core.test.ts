import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseQuestion, parseEvent, serializeEvent, schedule, reviewQueue, validFolder, newContext, sourceContext, type StudyEvent, type Question, type Attempt } from '../src/core';
const base=Date.parse('2026-09-01T08:00:00Z');
const q:Question={id:'q1',path:'数学/q1.md',title:'测试题',subject:'数学',topic:'求导',kind:'自拟题',source:'测试',prompt:'求 x² 的导数',hints:['考虑差商'],solution:'2x',method:'',reserved:false};
function attempt(key:string,time:number,help=0):StudyEvent {return {id:key,at:new Date(time).toISOString(),type:'attempt',subject:'数学',data:{id:key,questionId:'q1',subject:'数学',answer:'2x',hints:help,solutionSeen:false,startedAt:new Date(time-60000).toISOString(),submittedAt:new Date(time).toISOString()}};}
function check(key:string,time:number,verdict:'correct'|'partial'|'incorrect'|'unverified'='correct',source:'model'|'reference-check'='reference-check'):StudyEvent {return {id:'check-'+key,at:new Date(time+1000).toISOString(),type:'evaluation',subject:'数学',data:{attemptId:key,verdict,source,feedback:'测试核对'}};}
test('感觉理解和模型评分不能提升复习阶段',()=>{
  const events:StudyEvent[]=[attempt('a',base),check('a',base,'correct','model'),{id:'r',at:new Date(base+3000).toISOString(),type:'reflection',subject:'数学',data:{attemptId:'a',understood:true}}];
  const item=schedule([q],events,base)[0];assert.equal(item.stage,0);assert.match(item.reason,/尚未核对/);
});
test('用过提示做对与隔天独立核对正确有不同间隔',()=>{
  const events=[attempt('a',base,1),check('a',base)];assert.equal(schedule([q],events,base)[0].stage,0);
  events.push(attempt('b',base+86400000),check('b',base+86400000));assert.equal(schedule([q],events,base)[0].stage,1);
  events.push(attempt('c',base+2*86400000),check('c',base+2*86400000));assert.equal(schedule([q],events,base)[0].stage,2);
});
test('当场重复正确不能连续拉长复习间隔',()=>{
  const events=[attempt('a',base),check('a',base),attempt('b',base+600000),check('b',base+600000)];assert.equal(schedule([q],events,base)[0].stage,1);
});
test('查看解答后的正确不能作为未帮助证据',()=>{
  const event=attempt('a',base);if(event.type==='attempt')event.data.solutionSeen=true;
  const item=schedule([q],[event,check('a',base)],base)[0];assert.equal(item.stage,0);assert.match(item.reason,/提示或解答/);
});
test('延期不会算错，也不会立刻重新进入今日队列',()=>{
  const events:StudyEvent[]=[attempt('a',base),check('a',base),{id:'later',at:new Date(base+10000).toISOString(),type:'postpone',subject:'数学',data:{questionId:'q1',until:new Date(base+5*86400000).toISOString()}}];
  const items=schedule([q],events,base+86400000);assert.equal(items[0].stage,1);assert.equal(reviewQueue(items,20,base+86400000).length,0);
});
test('新题纳入队列，保留检验题不会被日常推荐',()=>{
  const items=schedule([q,{...q,id:'held',reserved:true}],[],base);assert.equal(items.length,1);assert.equal(items[0].question.id,'q1');
});
test('时间预算真正限制任务数量',()=>{
  const items=schedule(Array.from({length:8},(_,i)=>({...q,id:String(i)})),[],base);assert.equal(reviewQueue(items,10,base).length,2);assert.equal(reviewQueue(items,20,base).length,4);
});
test('题目只展示题干，空提示不作为求助',()=>{
  const parsed=parseQuestion('数学/题1.md','## 题目\n问题\n## 提示 1\n\n## 提示 2\n方向\n## 参考解答\n秘密答案',{study_type:'question',subject:'数学'});
  assert.equal(parsed?.prompt,'问题');assert.deepEqual(parsed?.hints,['方向']);assert.equal(parsed?.solution,'秘密答案');
});
test('记录含代码围栏和复杂文字时可以完整重建',()=>{
  const event=attempt('a',base);if(event.type==='attempt')event.data.answer='```js\n1 + 1\n```\n中文与公式 $x^2$';assert.deepEqual(parseEvent(serializeEvent(event)),event);
});
test('损坏记录不会被当作学习证据',()=>{
  assert.equal(parseEvent('```json\n{"type":"attempt","id":"x"}\n```'),null);
  assert.equal(parseEvent('not an event'),null);
});
test('记录位置不能逃离 Vault 或写入隐藏配置目录',()=>{
  for(const folder of ['../data','C:/data','/tmp','.obsidian','笔记/../../other','笔记/.git'])assert.throws(()=>validFolder(folder));
  assert.equal(validFolder('学习记录\\事件'),'学习记录/事件');
});
test('长笔记的发送截断显式标记且保留选区',()=>{
  const context=newContext('数学/a.md','a','数学','问题选区','x'.repeat(25000));const sent=JSON.parse(sourceContext(context));assert.equal(sent.noteText.length,20000);assert.equal(sent.truncated,true);assert.equal(sent.selection,'问题选区');
});
