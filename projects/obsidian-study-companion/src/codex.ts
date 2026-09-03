import { spawn, type ChildProcessWithoutNullStreams } from 'node:child_process';
import { createInterface } from 'node:readline';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve, dirname, basename } from 'node:path';
import { TUTOR_RULES } from './core';

export class RpcError extends Error { constructor(message:string,public code?:number){super(message);} }
export class JsonLineRpc {
  private sequence=0;
  private pending=new Map<number,{resolve:(value:any)=>void;reject:(error:Error)=>void;timer:ReturnType<typeof setTimeout>}>();
  listeners=new Set<(method:string,params:any)=>void>();
  constructor(private send:(line:string)=>void){}
  request(method:string,params:unknown={},timeout=30000):Promise<any>{
    const id=++this.sequence;
    return new Promise((resolve,reject)=>{
      const timer=setTimeout(()=>{this.pending.delete(id);reject(new Error('连接超时，输入和作答已保留。'));},timeout);
      this.pending.set(id,{resolve,reject,timer});
      try{this.send(JSON.stringify({id,method,params})+'\n');}catch(e){clearTimeout(timer);this.pending.delete(id);reject(e);}
    });
  }
  notify(method:string,params:unknown={}){this.send(JSON.stringify({method,params})+'\n');}
  receive(line:string){
    let msg:any;try{msg=JSON.parse(line);}catch{return;}
    if(msg.method && msg.id!==undefined){
      // This integration never grants tool execution, filesystem writes or permissions.
      const result=msg.method==='item/tool/requestUserInput'?{answers:{}}:msg.method==='item/permissions/requestApproval'?{permissions:{},scope:'turn'}:{decision:'decline'};
      if(msg.method.includes('requestApproval')||msg.method==='item/tool/requestUserInput')this.send(JSON.stringify({id:msg.id,result})+'\n');
      else this.send(JSON.stringify({id:msg.id,error:{code:-32601,message:'Unsupported client operation'}})+'\n');
      return;
    }
    if(msg.id!==undefined){const pending=this.pending.get(msg.id);if(!pending)return;clearTimeout(pending.timer);this.pending.delete(msg.id);if(msg.error)pending.reject(new RpcError(msg.error.message,msg.error.code));else pending.resolve(msg.result);return;}
    if(typeof msg.method==='string')for(const listener of this.listeners)listener(msg.method,msg.params);
  }
  close(error=new Error('连接已关闭，输入和作答已保留。')){for(const p of this.pending.values()){clearTimeout(p.timer);p.reject(error);}this.pending.clear();}
}
const DISABLED=['shell_tool','unified_exec','shell_snapshot','apps','plugins','remote_plugin','multi_agent','multi_agent_v2','browser_use','browser_use_external','computer_use','image_generation','memories','skill_search','hooks','skill_mcp_dependency_install','workspace_dependencies','in_app_browser','tool_suggest','artifact'];
export class CodexBridge {
  private child?:ChildProcessWithoutNullStreams;
  private rpc?:JsonLineRpc;
  private directory?:string;
  private starting?:Promise<void>;
  private config:Record<string,unknown>={};
  private active?:{threadId:string;turnId?:string;cancelled:boolean};
  private cancelCurrent?:()=>void;
  private responding=false;
  private cancelRequested=false;
  account:{connected:boolean;plan?:string}={connected:false};
  constructor(private binary:string,private model:string=''){}
  async connect(){
    if(this.starting){await this.starting;return this.readAccount();}
    if(this.rpc)return this.readAccount();
    if(!this.starting)this.starting=this.start().finally(()=>{this.starting=undefined;});
    await this.starting;return this.readAccount();
  }
  private async start(){
    if(!this.binary.trim()||/[\r\n]/.test(this.binary))throw new Error('请指定 Codex 可执行文件路径。');
    if(/\.(cmd|bat|ps1)$/i.test(this.binary))throw new Error('Windows 请填写 codex.exe 的路径，不能使用脚本包装器。');
    this.directory=await mkdtemp(join(tmpdir(),'obsidian-study-'));
    const args=['app-server','--listen','stdio://','-c','web_search="disabled"','-c','tools.view_image=false','-c','approval_policy="never"','-c','sandbox_mode="read-only"'];
    for(const feature of DISABLED)args.push('-c',`features.${feature}=false`);
    this.child=spawn(this.binary,args,{cwd:this.directory,shell:false,windowsHide:true,stdio:'pipe'});
    const child=this.child;
    this.rpc=new JsonLineRpc(line=>{if(child.stdin.destroyed)throw new Error('Codex 已退出。');child.stdin.write(line);});
    const rpc=this.rpc;
    createInterface({input:child.stdout}).on('line',line=>rpc.receive(line));
    // Drain stderr, but do not persist or expose account and configuration diagnostics.
    child.stderr.on('data',()=>{});
    child.on('error',()=>{rpc.close(new Error('无法启动 Codex。请在连接设置中检查可执行文件路径。'));this.cancelCurrent?.();this.rpc=undefined;});
    child.on('exit',()=>{rpc.close();this.cancelCurrent?.();if(this.child===child){this.rpc=undefined;this.child=undefined;this.account={connected:false};}});
    try{
      await rpc.request('initialize',{clientInfo:{name:'obsidian_study_companion',title:'Study Companion',version:'0.1.0'}});
      rpc.notify('initialized');
      const response=await rpc.request('config/read',{includeLayers:false});
      this.config={};
      for(const name of Object.keys(response.config?.mcp_servers||{})){
        if(!/^[a-zA-Z0-9_-]+$/.test(name))throw new Error('本机存在特殊名称的 MCP 配置，暂不支持内嵌连接。可使用复制上下文方式继续。');
        this.config[`mcp_servers.${name}.enabled`]=false;
      }
      for(const feature of DISABLED)this.config[`features.${feature}`]=false;
      this.config['web_search']='disabled';this.config['tools.view_image']=false;
    }catch(error){await this.dispose();throw error;}
  }
  private async readAccount(){
    const value=await this.rpc!.request('account/read',{refreshToken:false});
    this.account={connected:value.account?.type==='chatgpt',plan:value.account?.type==='chatgpt'?value.account.planType:undefined};
    return this.account;
  }
  async login():Promise<string>{await this.connect();const value=await this.rpc!.request('account/login/start',{type:'chatgpt'});return value.authUrl;}
  async answer(prompt:string,onText:(text:string)=>void=()=>{}):Promise<string>{
    if(this.responding)throw new Error('请等待当前回答结束，或先停止它。');
    this.responding=true;this.cancelRequested=false;try{return await this.runAnswer(prompt,onText);}finally{this.responding=false;}
  }
  private async runAnswer(prompt:string,onText:(text:string)=>void):Promise<string>{
    if(this.active)throw new Error('请等待当前回答结束，或先停止它。');
    const account=await this.connect();
    if(this.cancelRequested)throw new Error('已停止回答，输入已保留。');
    if(!account.connected)throw new Error('请先使用 ChatGPT 账号连接 Codex；本插件不会切换到付费 API。');
    const rpc=this.rpc!;
    const result=await rpc.request('thread/start',{cwd:this.directory,ephemeral:true,modelProvider:'openai',approvalPolicy:'never',sandbox:'read-only',...(this.model?{model:this.model}:{}),config:this.config,baseInstructions:TUTOR_RULES,developerInstructions:'仅回答输入中的学习问题。禁止工具调用、命令执行和读写任何文件。'});
    if(this.cancelRequested)throw new Error('已停止回答，输入已保留。');
    if(result.sandbox?.type!=='readOnly')throw new Error('当前 Codex 未采用只读模式，请检查配置后重试。');
    const threadId=result.thread.id as string;
    const active={threadId,turnId:undefined as string|undefined,cancelled:false};this.active=active;
    const chunks=new Map<string,string>();
    return new Promise<string>((resolve,reject)=>{
      let finished=false;
      const finish=(error?:Error)=>{
        if(finished)return;finished=true;clearTimeout(timer);rpc.listeners.delete(listener);this.cancelCurrent=undefined;this.active=undefined;
        const text=[...chunks.values()].join('\n\n').trim();
        if(error)reject(error);else if(!text)reject(new Error('没有收到回答，请重试。'));else resolve(text);
      };
      const listener=(method:string,p:any)=>{
        if(p?.threadId!==threadId)return;
        if(method==='turn/started')active.turnId=p.turn.id;
        if(method==='item/agentMessage/delta'){chunks.set(p.itemId,(chunks.get(p.itemId)||'')+p.delta);onText([...chunks.values()].join('\n\n'));}
        if(method==='item/completed' && p.item?.type==='agentMessage'){chunks.set(p.item.id,p.item.text);onText([...chunks.values()].join('\n\n'));}
        if(method==='turn/completed')finish(p.turn.status==='completed'?undefined:new Error(p.turn.status==='interrupted'?'已停止回答，内容保留。':p.turn.error?.message||'回答失败，请检查连接或额度。'));
        if(method==='error'&&!p.willRetry)finish(new Error(p.error?.message||'模型连接失败。'));
      };
      const timer=setTimeout(()=>{void this.interrupt();finish(new Error('回答超时，已保留输入和已收到的内容。'));},180000);
      this.cancelCurrent=()=>finish(new Error('回答已中断，内容已保留。'));
      rpc.listeners.add(listener);
      rpc.request('turn/start',{threadId,input:[{type:'text',text:prompt,text_elements:[]}],cwd:this.directory,approvalPolicy:'never',sandboxPolicy:{type:'readOnly',networkAccess:false}}).then(value=>{active.turnId=value.turn.id;if(active.cancelled)void this.interrupt();}).catch(error=>finish(error));
    });
  }
  async interrupt(){this.cancelRequested=true;const active=this.active;if(!active)return;active.cancelled=true;if(active.turnId&&this.rpc)await this.rpc.request('turn/interrupt',{threadId:active.threadId,turnId:active.turnId}).catch(()=>{});}
  async dispose(){this.cancelCurrent?.();this.rpc?.close();this.rpc=undefined;this.child?.stdin.end();this.child?.kill();this.child=undefined;this.account={connected:false};if(this.directory){const directory=resolve(this.directory);this.directory=undefined;if(dirname(directory)===resolve(tmpdir())&&basename(directory).startsWith('obsidian-study-'))await rm(directory,{recursive:true,force:true}).catch(()=>{});}}
}
