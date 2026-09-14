import { Plugin, MarkdownView, Notice, TFile, WorkspaceLeaf, Modal, normalizePath } from 'obsidian';
import { existsSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { CodexBridge } from './codex';
import { DEFAULT_DATA, MODE_CONFIG, id, newContext, parseCourseLesson, parseQuestion, recommendCourseLessons, validFolder, type Context, type CourseLesson, type PluginData, type Question, type Session, type StudyEvent, type TutorMode } from './core';
import { VaultStore } from './storage';
import { StudyView, DetailView, VIEW_TYPE, DETAIL_TYPE, ConnectionModal, CourseLessonModal, QuestionModal } from './view';

export default class StudyPlugin extends Plugin {
  data:PluginData=structuredClone(DEFAULT_DATA);
  events:StudyEvent[]=[];
  questions:Question[]=[];
  courseLessons:CourseLesson[]=[];
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
    this.addCommand({id:'add-course-lesson',name:'录入课程小节链接',callback:()=>new CourseLessonModal(this).open()});
    this.addCommand({id:'connection',name:'连接 ChatGPT / Codex',callback:()=>new ConnectionModal(this).open()});
    this.registerEvent(this.app.workspace.on('file-open',()=>this.views().forEach(view=>view.updateContextNotice())));
    this.lastNote=this.app.workspace.getActiveViewOfType(MarkdownView)||undefined;
    this.registerEvent(this.app.workspace.on('active-leaf-change',leaf=>{if(leaf?.view instanceof MarkdownView)this.lastNote=leaf.view;}));
    this.app.workspace.onLayoutReady(()=>{void this.reload().catch(this.report);void this.prewarm();});
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
    this.questions=[];this.courseLessons=[];const seen=new Set<string>();let duplicates=0;
    for(const file of this.app.vault.getMarkdownFiles()){
      const meta=this.app.metadataCache.getFileCache(file)?.frontmatter;
      if(meta?.study_type==='question'){
        const question=parseQuestion(file.path,await this.app.vault.cachedRead(file),meta);
        if(question){if(seen.has(question.id)){duplicates++;continue;}seen.add(question.id);this.questions.push(question);}
      }else if(meta?.study_type==='course_lesson'){
        const lesson=parseCourseLesson(file.path,meta);if(lesson)this.courseLessons.push(lesson);
      }
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
    void this.prewarm();
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
    this.data.activeSession=context.id;await this.persist();this.redraw();void this.prewarm(context.id);
  }
  async record(event:StudyEvent){await this.store.append(event);if(!this.events.some(e=>e.id===event.id))this.events.push(event);}
  recommendLessons(context:Context,question:string){return recommendCourseLessons(this.courseLessons,context,question);}
  async detail(title:string,text:string,sourcePath:string){
    const leaf=this.app.workspace.getLeaf('tab');await leaf.setViewState({type:DETAIL_TYPE,active:true,state:{title,text,sourcePath}});await this.app.workspace.revealLeaf(leaf);
  }
  async prewarm(conversationId=this.data.activeSession){try{await this.getBridge().prewarm(conversationId);}catch{/* Connection errors remain available in the explicit connection dialog. */}}
  async setMode(mode:TutorMode){if(this.data.settings.mode===mode)return;this.data.settings.mode=mode;await this.persist();await this.resetBridge();this.redraw();void this.prewarm();}
  getBridge(){
    if(!this.bridge){
      let binary=this.data.settings.codexPath;
      if(binary==='codex'&&process.platform==='win32'&&process.env.LOCALAPPDATA){
        const bin=join(process.env.LOCALAPPDATA,'OpenAI','Codex','bin');
        if(existsSync(bin)){const candidates=readdirSync(bin,{withFileTypes:true}).filter(x=>x.isDirectory()).map(x=>join(bin,x.name,'codex.exe')).filter(existsSync);if(candidates.length===1)binary=candidates[0];}
      }
      const mode=MODE_CONFIG[this.data.settings.mode]||MODE_CONFIG.fast;
      this.bridge=new CodexBridge(binary,mode.model,mode.effort);
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
  async createCourseLesson(input:{subject:string;provider:string;course:string;section:string;title:string;topics:string;url:string}){
    const topics=input.topics.split(/[，,、;]/).map(value=>value.trim()).filter(Boolean);
    const meta={study_type:'course_lesson',subject:input.subject.trim()||'未分科',provider:input.provider.trim(),course:input.course.trim(),section:input.section.trim(),lesson_title:input.title.trim(),topics,url:input.url.trim()};
    const folder='课程目录/'+meta.subject.replace(/[\\/:*?"<>|]/g,'-');const name=(meta.course+'-'+meta.section+'-'+meta.lesson_title).replace(/[\\/:*?"<>|]/g,'-');const path=normalizePath(`${folder}/${name}-${id().slice(0,6)}.md`);
    const lesson=parseCourseLesson(path,meta);if(!lesson)throw new Error('请填写课程、准确节次、小节标题、知识点和有效的 http/https 链接。');
    await this.store.ensureFolder(folder);
    const text=`---\nstudy_type: course_lesson\nsubject: ${JSON.stringify(meta.subject)}\nprovider: ${JSON.stringify(meta.provider||'未注明平台')}\ncourse: ${JSON.stringify(meta.course)}\nsection: ${JSON.stringify(meta.section)}\nlesson_title: ${JSON.stringify(meta.lesson_title)}\ntopics: ${JSON.stringify(topics)}\nurl: ${JSON.stringify(lesson.url)}\n---\n\n# ${meta.course} · ${meta.section} · ${meta.lesson_title}\n\n此条目用于按知识点推荐课程；链接和节次已经由使用者录入，后续如课程改版请人工复核。\n`;
    const file=await this.app.vault.create(path,text);this.courseLessons.push(lesson);new Notice('课程小节已保存在 '+file.path);return lesson;
  }
}
