import { test } from 'node:test';
import assert from 'node:assert/strict';
import { JsonLineRpc, CodexBridge } from '../src/codex';
test('乱序响应仍返回对应请求，通知不吞响应',async()=>{
  const sent:string[]=[];const rpc=new JsonLineRpc(line=>sent.push(line));let delta='';rpc.listeners.add((method,p)=>{if(method==='delta')delta+=p.text;});
  const first=rpc.request('first');const second=rpc.request('second');
  rpc.receive('{"method":"delta","params":{"text":"中"}}');rpc.receive('{"id":2,"result":"two"}');rpc.receive('{"id":1,"result":"one"}');
  assert.equal(await first,'one');assert.equal(await second,'two');assert.equal(delta,'中');rpc.close();
});
test('连接退出使挂起操作失败，不无限等待',async()=>{
  const rpc=new JsonLineRpc(()=>{});const pending=rpc.request('request');rpc.close();await assert.rejects(pending,/连接已关闭/);
});
test('权限和命令审批一律拒绝',()=>{
  const sent:string[]=[];const rpc=new JsonLineRpc(line=>sent.push(line));rpc.receive('{"id":41,"method":"item/commandExecution/requestApproval","params":{}}');assert.equal(JSON.parse(sent[0]).result.decision,'decline');
  rpc.receive('{"id":42,"method":"item/permissions/requestApproval","params":{}}');assert.deepEqual(JSON.parse(sent[1]).result.permissions,{});rpc.close();
});
test('未支持的服务端工具请求明确返回错误',()=>{
  const sent:string[]=[];const rpc=new JsonLineRpc(line=>sent.push(line));rpc.receive('{"id":2,"method":"item/tool/call","params":{}}');assert.equal(JSON.parse(sent[0]).error.code,-32601);rpc.close();
});
test('错误响应保留失败信息，普通非 JSON 日志不破坏协议',async()=>{
  const rpc=new JsonLineRpc(()=>{});const pending=rpc.request('turn/start');rpc.receive('log');rpc.receive('{"id":1,"error":{"code":429,"message":"额度不足"}}');await assert.rejects(pending,/额度不足/);rpc.close();
});
test('连接期间按停止，不会在连接完成后继续发送问题',async()=>{
  const bridge=new CodexBridge('unused');let ready!:(value:{connected:boolean})=>void;
  bridge.connect=()=>new Promise(resolve=>{ready=resolve;});
  const pending=bridge.answer('测试');await bridge.interrupt();ready({connected:true});await assert.rejects(pending,/已停止回答/);
});
test('同一连接的并发提问不会产生两次请求',async()=>{
  const bridge=new CodexBridge('unused');let ready!:(value:{connected:boolean})=>void;
  bridge.connect=()=>new Promise(resolve=>{ready=resolve;});
  const pending=bridge.answer('第一问');await assert.rejects(bridge.answer('第二问'),/等待当前回答/);await bridge.interrupt();ready({connected:true});await assert.rejects(pending,/已停止回答/);
});
