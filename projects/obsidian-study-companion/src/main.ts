import { Plugin, MarkdownView, Notice, TFile, WorkspaceLeaf, Modal, normalizePath } from 'obsidian';
import { existsSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { CodexBridge } from './codex';
import { DEFAULT_DATA, id, newContext, parseQuestion, validFolder, type Context, type PluginData, type Question, type Session, type StudyEvent } from './core';
import { VaultStore } from './storage';
import { StudyView, DetailView, VIEW_TYPE, DETAIL_TYPE, ConnectionModal, QuestionModal } from './view';

export default class StudyPlugin extends Plugin {
  data:PluginData=structuredClone(DEFAULT_DATA);
  events:StudyEvent[]=[];
  questions:Question[]=[];
  store!:VaultStore;
  bridge?:CodexBridge;
  busy=false;
  private lastNote?:MarkdownView;
  private writeQueue:Promise<void>=Promise.resolve();
  async onload(){
    const saved=await this.loadData();
    if(saved&&saved.version!==1){new Notice('学习插件数据版本无法识别，停止加载以保留原数据。');return;}
    if(saved){this.data={...this.data,...saved,settings:{...this.data.settings,...saved.settings},sessions:saved.sessions||{}};}
    validFolder(this.data.settings.recordsFolder);
    for(const session of Object.values(this.data.sessions))for(const message of session.messages)if(message.status==='pending')message.status='failed';
    this.store=new VaultStore(this.app,this.data.settings.recordsFolder);
    this.registerView(VIEW_TYPE,leaf=>new StudyView(leaf,this));
    this.registerView(DETAIL_TYPE,leaf=>new DetailView(leaf));
    this.addRibbonIcon('graduation-cap','打开学习侧栏',()=>void this.open());
    this.addCommand({id:'open-study',name:'打开学习侧栏',callback:()=>void this.open()});
    this.addCommand({id:'ask-selection',name:'围绕选区或当前笔记提问',editorCallback:()=>void this.capture().then(()=>this.open()).catch(this.report)});
    this.addCommand({id:'add-question',name:'把选区录入为练习题',editorCallback:()=>new QuestionModal(this).open()});
    this.addCommand({id:'connection',name:'连接 ChatGPT / Codex',callback:()=>new ConnectionModal(this).open()});
    this.registerEvent(this.app.workspace.on('file-open',()=>this.views().forEach(view=>view.updateContextNotice())));
    this.lastNote=this.app.workspace.getActiveViewOfType(MarkdownView)||undefined;
    this.registerEvent(this.app.workspace.on('active-leaf-change',leaf=>{if(leaf?.view instanceof MarkdownView)this.lastNote=leaf.view;}));
    this.app.workspace.onLayoutReady(()=>void this.reload().catch(this.report));
  }
  onunload(){void this.bridge?.dispose();}
  report=(error:unknown)=>{new Notice(error instanceof Error?error.message:String(error),8000);};
  views(){return this.app.workspace.getLeavesOfType(VIEW_TYPE).map(l=>l.view).filter((view):view is StudyView=>view instanceof StudyView);}
  redraw(){this.views().forEach(view=>view.render());}
  session():Session|undefined{return this.data.activeSession?this.data.sessions[this.data.activeSession]:undefined;}
  persist(){
    const snapshot=JSON.parse(JSON.stringify(this.data));
    const write=this.writeQueue.catch(()=>{}).then(()=>this.saveData(snapshot));
    this.writeQueue=write;return write;
  }
  async reload(){
    const loaded=await this.store.load();this.events=loaded.events;
    const draft=this.data.practice;
    if(draft?.pendingAttempt&&this.events.some(e=>e.type==='attempt'&&e.data.id===draft.pendingAttempt!.id)){draft.attemptId=draft.pendingAttempt.id;draft.pendingAttempt=undefined;await this.persist();}
    if(loaded.invalid)new Notice(`${loaded.invalid} 条记录无法识别，已保留原文件并跳过。`);
    this.questions=[];const seen=new Set<string>();let duplicates=0;
    for(const file of this.app.vault.getMarkdownFiles()){
      const meta=this.app.metadataCache.getFileCache(file)?.frontmatter;
      if(meta?.study_type!=='question')continue;
      const question=parseQuestion(file.path,await this.app.vault.cachedRead(file),meta);
      if(question){if(seen.has(question.id)){duplicates++;continue;}seen.add(question.id);this.questions.push(question);}
    }
    if(duplicates)new Notice(`${duplicates} 道题目的编号重复，请检查 question_id；重复题已跳过。`);
    this.redraw();
  }
  async open(){
    if(!this.session())await this.capture().catch(()=>{});
    const existing=this.app.workspace.getLeavesOfType(VIEW_TYPE)[0];
    const leaf=existing||this.app.workspace.getRightLeaf(false);
    if(!leaf)throw new Error('无法打开右侧栏。');
    if(!existing)await leaf.setViewState({type:VIEW_TYPE,active:true});
    await this.app.workspace.revealLeaf(leaf);
  }
  async capture(){
    const view=this.app.workspace.getActiveViewOfType(MarkdownView)||this.lastNote;
    const file=view?.file||this.app.workspace.getActiveFile();
    if(!file)throw new Error('先打开一篇笔记，再围绕它提问。');
    const meta=this.app.metadataCache.getFileCache(file)?.frontmatter;
    if(meta?.study_type==='event')throw new Error('请选择课程笔记或题目，而不是原始事件记录。');
    const text=view?.file?.path===file.path?view.editor.getValue():await this.app.vault.read(file);
    const selection=view?.editor.getSelection()||'';
    const subject=typeof meta?.subject==='string'?meta.subject:(file.path.includes('/')?file.path.split('/')[0]:'未分科');
    const context=newContext(file.path,file.basename,subject,selection,text);
    const old=this.data.sessions[context.id];
    this.data.sessions[context.id]=old?{...old,context}:{context,messages:[],questionDraft:'',understanding:''};
    this.data.activeSession=context.id;await this.persist();this.redraw();
  }
  async record(event:StudyEvent){await this.store.append(event);if(!this.events.some(e=>e.id===event.id))this.events.push(event);}
  async detail(title:string,text:string,sourcePath:string){
    const leaf=this.app.workspace.getLeaf('tab');await leaf.setViewState({type:DETAIL_TYPE,active:true,state:{title,text,sourcePath}});await this.app.workspace.revealLeaf(leaf);
  }
  getBridge(){
    if(!this.bridge){
      let binary=this.data.settings.codexPath;
      if(binary==='codex'&&process.platform==='win32'&&process.env.LOCALAPPDATA){
        const bin=join(process.env.LOCALAPPDATA,'OpenAI','Codex','bin');
        if(existsSync(bin)){const candidates=readdirSync(bin,{withFileTypes:true}).filter(x=>x.isDirectory()).map(x=>join(bin,x.name,'codex.exe')).filter(existsSync);if(candidates.length===1)binary=candidates[0];}
      }
      this.bridge=new CodexBridge(binary,this.data.settings.model);
    }return this.bridge;
  }
  async resetBridge(){await this.bridge?.dispose();this.bridge=undefined;}
  async createQuestion(input:{title:string;subject:string;source:string;prompt:string;solution:string;hints:string;topic:string}){
    if(!input.title.trim()||!input.prompt.trim())throw new Error('请填写题目名称和题干。');
    const folder='学习题库/'+(input.subject.trim()||'未分科').replace(/[\\/:*?"<>|]/g,'-');await this.store.ensureFolder(folder);
    const questionId=id();const path=normalizePath(`${folder}/${input.title.replace(/[\\/:*?"<>|]/g,'-')}-${questionId.slice(0,6)}.md`);
    const text=`---\nstudy_type: question\nquestion_id: ${questionId}\nsubject: ${JSON.stringify(input.subject||'未分科')}\ntopic: ${JSON.stringify(input.topic||'未指定')}\nquestion_kind: 自录题\nsource: ${JSON.stringify(input.source||'未注明来源')}\nreserved: false\n---\n\n# ${input.title}\n\n## 题目\n\n${input.prompt}\n\n## 提示 1\n\n${input.hints}\n\n## 参考解答\n\n${input.solution}\n\n## 方法总结\n\n`;
    const file=await this.app.vault.create(path,text);
    const question=parseQuestion(path,text,{study_type:'question',question_id:questionId,subject:input.subject||'未分科',topic:input.topic,source:input.source,question_kind:'自录题'});
    if(question)this.questions.push(question);
    this.redraw();new Notice('题目已保存在 '+file.path);return question;
  }
}
