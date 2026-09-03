import { Component, ItemView, MarkdownRenderer, MarkdownView, Menu, Modal, Notice, TFile, type EventRef, type WorkspaceLeaf } from 'obsidian';
import type StudyPlugin from './main';
import { id, reviewQueue, schedule, sourceContext, TUTOR_RULES, type Question, type Session, type Tab, type Verdict } from './core';
import { watchChatScroll, watchStatusBar } from './layout';

export const VIEW_TYPE='study-companion-view';
export const DETAIL_TYPE='study-companion-detail';
const label=(parent:HTMLElement,text:string,cls='sc-muted')=>parent.createEl('p',{text,cls});
function button(parent:HTMLElement,text:string,action:(event:MouseEvent)=>unknown,primary=false){
  const b=parent.createEl('button',{text,cls:primary?'mod-cta':'sc-text-button'});b.type='button';
  b.addEventListener('click',event=>{b.disabled=true;Promise.resolve().then(()=>action(event)).catch(error=>new Notice(error instanceof Error?error.message:String(error),8000)).finally(()=>{b.disabled=false;});});return b;
}
function field(parent:HTMLElement,title:string,value:string,change:(text:string)=>void,rows=3){
  const wrapper=parent.createEl('label',{cls:'sc-field'});wrapper.createSpan({text:title});
  const input=wrapper.createEl('textarea');input.value=value;input.rows=rows;
  input.addEventListener('input',()=>change(input.value));return input;
}
async function markdown(view:{app:ItemView['app']},text:string,target:HTMLElement,path:string,component:Component){
  // Remote images are not fetched automatically from generated Markdown.
  const safe=text.replace(/!\[([^\]]*)\]\(https?:[^)]+\)/gi,'[图片：$1]').replace(/<img\b[^>]*>/gi,'');
  await MarkdownRenderer.render(view.app,safe,target,path,component);
}
export class StudyView extends ItemView {
  private body?:HTMLElement;
  private contextNotice?:HTMLElement;
  private renderer=new Component();
  private scroll:Record<Tab,number>={chat:0,practice:0,review:0};
  private renderedTab:Tab='chat';
  private subjectFilter='';
  private message='';
  private bottomSpace?:ReturnType<typeof watchStatusBar>;
  private layoutEvent?:EventRef;
  private chatScroll?:ReturnType<typeof watchChatScroll>;
  private followChat=true;
  private chatSessionId?:string;
  constructor(leaf:WorkspaceLeaf,public plugin:StudyPlugin){super(leaf);}
  getViewType(){return VIEW_TYPE;}
  getDisplayText(){return '学习';}
  getIcon(){return 'graduation-cap';}
  async onOpen(){this.contentEl.addClass('sc-root');this.render();this.bottomSpace=watchStatusBar(this.contentEl);this.layoutEvent=this.app.workspace.on('layout-change',()=>this.bottomSpace?.refresh());}
  async onClose(){this.chatScroll?.stop();this.bottomSpace?.stop();if(this.layoutEvent)this.app.workspace.offref(this.layoutEvent);this.renderer.unload();await this.plugin.persist().catch(this.plugin.report);}
  updateContextNotice(){
    const file=this.app.workspace.getActiveFile();const session=this.plugin.session();
    if(this.contextNotice)this.contextNotice.hidden=!session||!file||file.path===session.context.path;
  }
  status(text:string){this.message=text;this.render();}
  render(followLatest=false){
    if(this.body)this.scroll[this.renderedTab]=this.body.scrollTop;
    if(this.chatScroll)this.followChat=this.chatScroll.following;
    this.chatScroll?.stop();this.chatScroll=undefined;
    const composer=this.contentEl.querySelector<HTMLTextAreaElement>('.sc-composer');
    const hadFocus=!!composer&&this.contentEl.ownerDocument.activeElement===composer;
    const selection=hadFocus?[composer.selectionStart,composer.selectionEnd]:undefined;
    this.renderer.unload();this.renderer=new Component();this.renderer.load();
    const container=this.contentEl;container.empty();
    this.renderedTab=this.plugin.data.tab;
    const session=this.plugin.session();
    if(followLatest||this.chatSessionId!==session?.context.id)this.followChat=true;
    this.chatSessionId=session?.context.id;
    const header=container.createDiv({cls:'sc-header'});
    const toolbar=header.createDiv({cls:'sc-toolbar'});
    const nav=toolbar.createEl('nav',{cls:'sc-tabs',attr:{'aria-label':'学习入口'}});
    for(const [tab,title] of [['chat','聊天'],['practice','练习'],['review','复习']] as const){const b=button(nav,title,async()=>{this.plugin.data.tab=tab;this.message='';await this.plugin.persist();this.render();});b.setAttribute('aria-pressed',String(this.plugin.data.tab===tab));}
    const tools=toolbar.createDiv({cls:'sc-tools'});
    const expand=button(tools,'展开',()=>this.openInMain());expand.classList.add('sc-expand');expand.title='在主笔记区打开学习';
    const more=button(tools,'···',event=>this.showMenu(event));more.setAttribute('aria-label','更多操作');more.title='连接、切换笔记与外部问答';more.setAttribute('aria-haspopup','menu');
    if(session){
      const reference=header.createEl('details',{cls:'sc-context-reference'});
      const title=session.context.subject+' / '+session.context.title;
      const summary=reference.createEl('summary');summary.title=title+'（点击查看引用内容）';
      summary.createSpan({text:session.context.selection?'选区':'笔记',cls:'sc-context-kind'});summary.createSpan({text:title,cls:'sc-context-title'});
      const preview=reference.createDiv({cls:'sc-context-preview'});
      label(preview,session.context.selection||session.context.text.slice(0,800),'sc-reference-text');
      label(preview,'提问时发送本篇引用和最近对话；不会自动上传整个知识库。');
      button(preview,'更新为当前笔记 / 选区',()=>this.plugin.capture());
    }
    this.contextNotice=container.createDiv({cls:'sc-context-notice'});label(this.contextNotice,'仍引用上篇笔记');button(this.contextNotice,'改用当前笔记',()=>this.plugin.capture());this.updateContextNotice();
    this.body=container.createDiv({cls:'sc-body'});
    const footer=container.createDiv({cls:'sc-footer'});
    if(this.plugin.data.tab==='chat')this.renderChat(this.body,footer,session);
    else if(this.plugin.data.tab==='practice')this.renderPractice(this.body,footer);
    else this.renderReview(this.body,footer);
    if(this.message)label(footer,this.message,'sc-status').setAttribute('role','status');
    this.body.scrollTop=this.scroll[this.renderedTab];
    const messages=this.body.querySelector<HTMLElement>('.sc-chat-messages');
    if(messages)this.chatScroll=watchChatScroll(this.body,messages,this.followChat);
    if(hadFocus){const next=this.contentEl.querySelector<HTMLTextAreaElement>('.sc-composer');next?.focus({preventScroll:true});if(selection)next?.setSelectionRange(selection[0],selection[1]);}
    this.bottomSpace?.refresh();
  }
  private renderChat(body:HTMLElement,footer:HTMLElement,session?:Session){
    if(!session){label(body,'打开课程笔记，选中不懂的文字，再开始提问。');button(body,'使用当前笔记',()=>this.plugin.capture(),true);return;}
    body.classList.add('sc-chat-body');
    const messages=body.createDiv({cls:'sc-chat-messages',attr:{role:'log','aria-label':'聊天记录','aria-live':'polite','aria-relevant':'additions'}});
    if(!session.messages.length){const empty=messages.createDiv({cls:'sc-chat-empty'});empty.createEl('p',{text:'有什么想问的？',cls:'sc-empty-title'});label(empty,'可以围绕上方笔记继续聊。');}
    for(const message of session.messages){
      const article=messages.createEl('article',{cls:'sc-message sc-message-'+message.role,attr:{'aria-label':message.role==='user'?'我的消息':'助手回复'}});
      const answer=article.createDiv({cls:'sc-markdown',attr:{'data-message-id':message.id}});
      if(message.role==='user'||message.status==='pending'){answer.classList.add('sc-plain-message');answer.setText(message.text||'正在回复…');}else void markdown(this,message.text,answer,session.context.path,this.renderer);
      if(message.status==='failed')label(article,'本次回答未完成，已收到的文字仍保留。');
      if(message.role==='assistant'&&message.text&&message.status!=='pending'){
        const actions=article.createDiv({cls:'sc-message-actions'});
        button(actions,'复制',async()=>{await navigator.clipboard.writeText(message.text);new Notice('已复制回答，可粘贴到笔记。');}).setAttribute('aria-label','复制回答');
      }
    }
    footer.classList.add('sc-chat-footer');
    const input=field(footer,'发送消息',session.questionDraft,text=>{session.questionDraft=text;void this.plugin.persist().catch(this.plugin.report);},1);
    input.parentElement!.classList.add('sc-composer-field');
    input.placeholder='发送消息…';input.title='Enter 发送；Shift + Enter 换行';input.classList.add('sc-composer');
    input.addEventListener('keydown',event=>{if(event.key==='Enter'&&!event.shiftKey&&!event.isComposing&&event.keyCode!==229){event.preventDefault();if(!this.plugin.busy&&input.value.trim())void this.sendChat().catch(this.plugin.report);}});
    const actions=footer.createDiv({cls:'sc-actions sc-compose-actions'});label(actions,'Shift + Enter 换行','sc-keyhint').title='Enter 发送；Shift + Enter 换行';
    if(this.plugin.busy)button(actions,'停止',()=>this.plugin.getBridge().interrupt());
    else button(actions,'发送',()=>this.sendChat(),true);
  }
  private async openInMain(){
    await this.plugin.persist();const leaf=this.app.workspace.getLeaf('tab');await leaf.setViewState({type:VIEW_TYPE,active:true});this.leaf.detach();await this.app.workspace.revealLeaf(leaf);
  }
  private showMenu(event:MouseEvent){
    const menu=new Menu();
    const item=(title:string,action:()=>unknown)=>menu.addItem(entry=>entry.setTitle(title).onClick(()=>{void Promise.resolve().then(action).catch(this.plugin.report);}));
    item('连接 ChatGPT / Codex',()=>new ConnectionModal(this.plugin).open());
    item('更新为当前笔记 / 选区',()=>this.plugin.capture());
    item('在主区打开学习',()=>this.openInMain());
    const session=this.plugin.session();
    if(session){
      menu.addSeparator();
      item('复制问题与上下文到 ChatGPT / Codex',async()=>{if(!session.questionDraft.trim())throw new Error('先输入本次问题。');await navigator.clipboard.writeText(this.chatPrompt(session,session.questionDraft));new Notice('已复制，可粘贴到 ChatGPT 或 Codex。');});
      item('粘贴外部回答',()=>new TextModal(this.plugin,'粘贴外部回答','回答内容','',async text=>{session.messages.push({id:id(),role:'user',text:session.questionDraft||'外部辅导记录',status:'complete'},{id:id(),role:'assistant',text:'外部回答，内容待核实：\n\n'+text,status:'complete'});session.questionDraft='';await this.plugin.persist();this.render();}).open());
    }
    const anchor=(event.currentTarget||event.target) as HTMLElement;
    if(event.detail===0&&anchor){const rect=anchor.getBoundingClientRect();menu.showAtPosition({x:rect.left,y:rect.bottom});}
    else menu.showAtMouseEvent(event);
  }
  private chatPrompt(session:Session,question:string){
    return TUTOR_RULES+'\n资料（JSON）：\n'+sourceContext(session.context)+'\n最近对话（JSON）：\n'+JSON.stringify(session.messages.filter(m=>m.status==='complete').slice(-16).map(m=>({role:m.role,text:m.text.slice(0,6000)})))+'\n本次问题：\n'+question;
  }
  private async sendChat(){
    const session=this.plugin.session();if(!session)return;
    const question=session.questionDraft.trim();if(!question)throw new Error('先输入你的问题。');if(this.plugin.busy)return;
    const prompt=this.chatPrompt(session,question);
    const answer={id:id(),role:'assistant' as const,text:'',status:'pending' as 'pending'|'complete'|'failed'};
    this.plugin.busy=true;
    session.messages.push({id:id(),role:'user',text:question,status:'complete'},answer);
    try{
      await this.plugin.persist();session.questionDraft='';this.message='';this.render(true);
      this.contentEl.querySelector<HTMLTextAreaElement>('.sc-composer')?.focus({preventScroll:true});
      answer.text=await this.plugin.getBridge().answer(prompt,text=>{
        answer.text=text;
        for(const view of this.plugin.views()){
          const target=view.contentEl.querySelector(`[data-message-id="${answer.id}"]`);
          if(target)target.textContent=text;
        }
      });answer.status='complete';
    }catch(error){answer.status='failed';if(!session.questionDraft.trim())session.questionDraft=question;this.message=error instanceof Error?error.message:String(error);}
    finally{this.plugin.busy=false;await this.plugin.persist();this.plugin.redraw();}
  }
  private async begin(question:Question){
    if(this.plugin.data.practice&&!this.plugin.data.practice.attemptId&&this.plugin.data.practice.answer.trim())throw new Error('先提交当前尝试，再开始另一道题。原作答仍保留。');
    this.plugin.data.practice={questionId:question.id,answer:'',hints:0,solutionSeen:false,startedAt:new Date().toISOString()};
    this.plugin.data.tab='practice';await this.plugin.persist();this.message='';this.render();
  }
  private renderPractice(body:HTMLElement,footer:HTMLElement){
    const draft=this.plugin.data.practice;const question=this.plugin.questions.find(q=>q.id===draft?.questionId);
    if(!draft||!question){
      if(draft)label(body,'当前题目暂未找到，作答草稿仍保留。请检查题目文件或刷新题库。');
      label(body,'从真实例题或典型题开始，一次处理一道。');
      button(body,'录入题目',()=>new QuestionModal(this.plugin).open(),true);
      button(body,'刷新题库',()=>this.plugin.reload());
      const subject=this.subjectFilter||this.plugin.session()?.context.subject;
      const questions=this.plugin.questions.filter(q=>!q.reserved&&(!subject||q.subject===subject));
      for(const q of questions.slice(0,20)){const row=body.createDiv({cls:'sc-review-row'});label(row,q.title,'sc-question-title');label(row,q.subject+' · '+q.kind);button(row,'开始',()=>this.begin(q));}
      if(!questions.length)label(body,'当前学科还没有题目。录入后即可练习，也可以在 Markdown 中持续完善解答和提示。');return;
    }
    label(body,question.kind+' · '+question.source);
    const prompt=body.createDiv({cls:'sc-markdown sc-problem'});void markdown(this,question.prompt,prompt,question.path,this.renderer);
    label(body,draft.solutionSeen?'已查看参考解答':draft.hints?`已使用 ${draft.hints} 步提示`:'未使用插件提示','sc-assistance');
    const input=field(body,'我的思路或作答',draft.answer,text=>{draft.answer=text;void this.plugin.persist().catch(this.plugin.report);},5);input.disabled=!!draft.attemptId||!!draft.pendingAttempt;
    if(!draft.attemptId){const row=body.createDiv({cls:'sc-actions'});
      if(question.hints.length>draft.hints)button(row,draft.hints?'再提示一步':'给一点提示',async()=>{draft.hints++;await this.plugin.persist();this.render();});
      if(!question.hints.length)label(row,'这道题尚未补充提示。');
      button(row,draft.pendingAttempt?'重试保存原始尝试':'提交尝试',()=>this.submit(),true);
    }
    for(const hint of question.hints.slice(0,draft.hints)){const h=body.createDiv({cls:'sc-hint'});void markdown(this,hint,h,question.path,this.renderer);}
    if(question.solution){
      if(!draft.solutionSeen)button(body,'查看参考解答',async()=>{draft.solutionSeen=true;await this.plugin.persist();this.render();});
      else{const solution=body.createEl('details',{cls:'sc-reference'});solution.open=true;solution.createEl('summary',{text:'参考解答'});const text=solution.createDiv({cls:'sc-markdown'});void markdown(this,question.solution,text,question.path,this.renderer);}
    }else label(body,'尚无参考解答；模型反馈只能作为待核实建议。');
    if(draft.attemptId){
      const attempt=this.plugin.events.find(e=>e.type==='attempt'&&e.data.id===draft.attemptId);
      if(attempt?.type==='attempt')label(body,(attempt.data.solutionSeen?'提交前看过解答':attempt.data.hints?'提交前用过提示':'提交前未用插件提示')+' · 原始作答已保存');
      if(draft.feedback){const feedback=body.createDiv({cls:'sc-markdown'});void markdown(this,draft.feedback,feedback,question.path,this.renderer);}
      if(!this.plugin.busy)button(body,'请老师分析卡点',()=>this.evaluate());else button(body,'停止分析',()=>this.plugin.getBridge().interrupt());
      if(draft.solutionSeen&&question.solution){
        label(body,'对照可靠参考解答，核对原始提交：');const row=body.createDiv({cls:'sc-actions'});
        for(const [value,title] of [['correct','核对正确'],['partial','部分正确'],['incorrect','还不正确']] as const){const b=button(row,title,async()=>{await this.plugin.record({id:id(),at:new Date().toISOString(),type:'evaluation',subject:question.subject,data:{attemptId:draft.attemptId!,verdict:value,feedback:'用户对照参考解答核对原始提交。',source:'reference-check'}});draft.referenceVerdict=value;await this.plugin.persist();this.render();});b.setAttribute('aria-pressed',String(draft.referenceVerdict===value));}
      }
      label(body,'理解自评（不直接算作掌握）：');const reflection=body.createDiv({cls:'sc-actions'});
      for(const [understood,title] of [[true,'方法清楚了'],[false,'还有卡点']] as const)button(reflection,title,async()=>{await this.plugin.record({id:id(),at:new Date().toISOString(),type:'reflection',subject:question.subject,data:{attemptId:draft.attemptId!,understood}});this.status('自评已记录，与作答核对分开保存。');});
      if(question.method){const method=body.createEl('details');method.createEl('summary',{text:'归纳方法'});void markdown(this,question.method,method.createDiv({cls:'sc-markdown'}),question.path,this.renderer);}
      button(footer,'选择下一题',async()=>{this.plugin.data.practice=undefined;await this.plugin.persist();this.render();});
    }
    label(footer,'题目来源与解答可以在原始 Markdown 中完善。');
  }
  private async submit(){
    const draft=this.plugin.data.practice;if(!draft||draft.attemptId)return;
    const question=this.plugin.questions.find(q=>q.id===draft.questionId);if(!question)return;
    if(!draft.answer.trim())throw new Error('先留下尝试，也可以写“还不知道从哪里开始”。');
    if(!draft.pendingAttempt){const now=new Date().toISOString();draft.pendingAttempt={id:id(),questionId:question.id,subject:question.subject,answer:draft.answer,hints:draft.hints,solutionSeen:draft.solutionSeen,startedAt:draft.startedAt,submittedAt:now};this.render();await this.plugin.persist();}
    const attempt=draft.pendingAttempt;
    await this.plugin.record({id:attempt.id,at:attempt.submittedAt,type:'attempt',subject:question.subject,data:attempt});
    draft.attemptId=attempt.id;draft.pendingAttempt=undefined;await this.plugin.persist();this.message='先保留尝试，再对照解答或请求反馈。';this.render();
  }
  private async evaluate(){
    const draft=this.plugin.data.practice;const question=this.plugin.questions.find(q=>q.id===draft?.questionId);if(!draft?.attemptId||!question||this.plugin.busy)return;
    const event=this.plugin.events.find(e=>e.type==='attempt'&&e.data.id===draft.attemptId);if(event?.type!=='attempt')throw new Error('找不到原始提交，未发起评价。');
    this.plugin.busy=true;this.render();
    try{
      const feedback=await this.plugin.getBridge().answer(TUTOR_RULES+'\n请分析以下原始尝试，说明依据、一个可能的卡点和下一步。没有可靠解答时明确待核实，不打掌握度分数。\n'+JSON.stringify({question:question.prompt,reference:question.solution||null,source:question.source,attempt:event.data}));
      await this.plugin.record({id:id(),at:new Date().toISOString(),type:'evaluation',subject:question.subject,data:{attemptId:draft.attemptId,verdict:'unverified',feedback,source:'model'}});draft.feedback='模型反馈（待核实）：\n\n'+feedback;
    }catch(error){this.message=error instanceof Error?error.message:String(error);}finally{this.plugin.busy=false;await this.plugin.persist();this.plugin.redraw();}
  }
  private renderReview(body:HTMLElement,footer:HTMLElement){
    const controls=body.createDiv({cls:'sc-review-controls'});
    const subjects=[...new Set(this.plugin.questions.map(q=>q.subject))].sort();
    const subjectLabel=controls.createEl('label',{text:'学科 '});const select=subjectLabel.createEl('select');select.createEl('option',{text:'全部学科',value:''});for(const subject of subjects)select.createEl('option',{text:subject,value:subject});select.value=this.subjectFilter;select.addEventListener('change',()=>{this.subjectFilter=select.value;this.render();});
    const budgetLabel=controls.createEl('label',{text:'本次 '});const budget=budgetLabel.createEl('select');for(const value of [10,20,30])budget.createEl('option',{text:value+' 分钟',value:String(value)});budget.value=String(this.plugin.data.settings.minutes);budget.addEventListener('change',()=>{this.plugin.data.settings.minutes=Number(budget.value);void this.plugin.persist().then(()=>this.render()).catch(this.plugin.report);});
    const all=schedule(this.plugin.questions.filter(q=>!this.subjectFilter||q.subject===this.subjectFilter),this.plugin.events);
    const queue=reviewQueue(all,this.plugin.data.settings.minutes);
    label(body,queue.length?`本次 ${queue.length} 项 · 时间为粗略估计`:'当前没有到期任务。可以添加新题，或调整已有记录。');
    for(const item of queue){const row=body.createEl('article',{cls:'sc-review-row'});row.createEl('strong',{text:item.question.title});label(row,item.question.subject+' · 约 '+item.minutes+' 分钟');label(row,item.reason);const actions=row.createDiv({cls:'sc-actions'});button(actions,'开始',()=>this.begin(item.question));button(actions,'明天再做',async()=>{const now=new Date();const until=new Date(now);until.setDate(until.getDate()+1);until.setHours(8,0,0,0);await this.plugin.record({id:id(),at:now.toISOString(),type:'postpone',subject:item.question.subject,data:{questionId:item.question.id,until:until.toISOString()}});this.render();});}
    const future=all.filter(q=>q.due>Date.now());if(future.length){const details=body.createEl('details');details.createEl('summary',{text:`稍后安排 · ${future.length} 项`});for(const item of future.slice(0,20)){label(details,item.question.title+' · '+new Date(item.due).toLocaleDateString());button(details,'提前练习',()=>this.begin(item.question));}}
    button(footer,'刷新题目与记录',()=>this.plugin.reload());button(footer,'录入题目',()=>new QuestionModal(this.plugin).open());label(footer,'延期不记错；自评不等于掌握。原题做熟后仍需用新题检查迁移。');
  }
}

export class DetailView extends ItemView {
  private state={title:'学习解释',text:'',sourcePath:''};
  private renderer=new Component();
  getViewType(){return DETAIL_TYPE;}getDisplayText(){return this.state.title;}getIcon(){return 'book-open';}
  async onOpen(){this.renderer.load();this.render();}
  async onClose(){this.renderer.unload();}
  async setState(state:any,result:any){if(state&&typeof state.text==='string')this.state={title:String(state.title||'学习解释'),text:state.text,sourcePath:String(state.sourcePath||'')};this.render();await super.setState(state,result);}
  getState(){return this.state;}
  render(){this.contentEl.empty();this.contentEl.addClass('sc-detail');const body=this.contentEl.createDiv({cls:'sc-detail-content'});button(body,'返回原笔记',async()=>{if(this.state.sourcePath)await this.app.workspace.openLinkText(this.state.sourcePath,'',false);});body.createEl('h1',{text:this.state.title});void markdown(this,this.state.text,body.createDiv({cls:'sc-markdown'}),this.state.sourcePath,this.renderer);}
}
export class TextModal extends Modal {
  constructor(private plugin:StudyPlugin,private title:string,private fieldLabel:string,private value:string,private save:(text:string)=>Promise<void>){super(plugin.app);}
  onOpen(){this.contentEl.createEl('h2',{text:this.title});let text=this.value;field(this.contentEl,this.fieldLabel,text,value=>{text=value;},8);button(this.contentEl,'保存',async()=>{if(!text.trim())throw new Error('内容不能为空。');await this.save(text);this.close();},true);}
}
export class ConnectionModal extends Modal {
  constructor(private plugin:StudyPlugin){super(plugin.app);}
  onOpen(){
    this.contentEl.createEl('h2',{text:'连接 ChatGPT / Codex'});
    label(this.contentEl,'使用本机 Codex 的 ChatGPT 登录与订阅额度。不需要 API Key。');
    const executable=field(this.contentEl,'Codex 可执行文件',this.plugin.data.settings.codexPath,()=>{},1);
    const model=field(this.contentEl,'模型（留空使用 Codex 默认）',this.plugin.data.settings.model,()=>{},1);
    const status=label(this.contentEl,'尚未检查连接');status.setAttribute('role','status');
    const configure=async()=>{this.plugin.data.settings.codexPath=executable.value.trim()||'codex';this.plugin.data.settings.model=model.value.trim();await this.plugin.persist();await this.plugin.resetBridge();};
    button(this.contentEl,'检查连接',async()=>{status.setText('正在检查…');try{await configure();const account=await this.plugin.getBridge().connect();status.setText(account.connected?'已连接 ChatGPT'+(account.plan?' · '+account.plan:''):'本机 Codex 尚未使用 ChatGPT 登录。');}catch(error){status.setText(error instanceof Error?error.message:String(error));}},true);
    button(this.contentEl,'使用 ChatGPT 登录',async()=>{await configure();const url=await this.plugin.getBridge().login();const parsed=new URL(url);if(parsed.protocol!=='https:'||!['auth.openai.com','chatgpt.com'].includes(parsed.hostname))throw new Error('登录地址异常，未打开。');window.open(url);status.setText('请在浏览器完成登录，然后点击“检查连接”。');});
    label(this.contentEl,'仅在提问或分析时发送所选资料。额度不足时保留输入；也可复制问题到 ChatGPT，再粘贴回答。');
  }
}
export class QuestionModal extends Modal {
  constructor(private plugin:StudyPlugin){super(plugin.app);}
  onOpen(){
    const view=this.app.workspace.getActiveViewOfType(MarkdownView);const session=this.plugin.session();
    const input={title:'',subject:session?.context.subject||'未分科',source:view?.file?.path||session?.context.path||'',prompt:view?.editor.getSelection()||session?.context.selection||'',solution:'',hints:'',topic:''};
    this.contentEl.createEl('h2',{text:'录入一道题'});
    label(this.contentEl,'保留真题的年份、题号或教材页码。没有来源时标记为自录题。');
    field(this.contentEl,'题目名称',input.title,text=>{input.title=text;},1);field(this.contentEl,'学科',input.subject,text=>{input.subject=text;},1);
    field(this.contentEl,'来源 / 页码 / 题号',input.source,text=>{input.source=text;},1);field(this.contentEl,'题干（支持 Markdown 和公式）',input.prompt,text=>{input.prompt=text;},4);
    field(this.contentEl,'参考解答（可稍后完善）',input.solution,text=>{input.solution=text;},3);field(this.contentEl,'第一步提示（可选）',input.hints,text=>{input.hints=text;},2);
    button(this.contentEl,'保存到题库',async()=>{await this.plugin.createQuestion(input);this.close();},true);
  }
}
