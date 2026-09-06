import { TFile, TFolder, type App, MarkdownView } from 'obsidian';
import { hash, parseEvent, serializeEvent, validFolder, type StudyEvent, type Context } from './core';
export class VaultStore {
  constructor(private app:App,private folder:string){validFolder(folder);}
  async ensureFolder(path:string){
    const parts=validFolder(path).split('/');let current='';
    for(const part of parts){current=current?current+'/'+part:part;const file=this.app.vault.getAbstractFileByPath(current);if(file&&! (file instanceof TFolder))throw new Error('目录位置已经存在同名文件：'+current);if(!file)try{await this.app.vault.createFolder(current);}catch(error){if(!(this.app.vault.getAbstractFileByPath(current) instanceof TFolder))throw error;}}
  }
  async append(event:StudyEvent){
    const date=new Date(event.at);const folder=`${validFolder(this.folder)}/事件/${date.getFullYear()}/${String(date.getMonth()+1).padStart(2,'0')}`;
    await this.ensureFolder(folder);const path=folder+'/'+event.id+'.md';const text=serializeEvent(event);
    const existing=this.app.vault.getAbstractFileByPath(path);
    if(existing instanceof TFile){if(await this.app.vault.read(existing)===text)return;throw new Error('记录编号发生冲突，原记录未覆盖。');}
    await this.app.vault.create(path,text);
  }
  async load(){
    const files=this.app.vault.getMarkdownFiles().filter(f=>f.path.startsWith(validFolder(this.folder)+'/事件/'));
    const events:StudyEvent[]=[];let invalid=0;const seen=new Set<string>();
    for(const file of files){const event=parseEvent(await this.app.vault.cachedRead(file));if(!event||seen.has(event.id)){invalid++;continue;}seen.add(event.id);events.push(event);}
    return {events,invalid};
  }
  async appendUnderstanding(context:Context,text:string){
    const file=this.app.vault.getAbstractFileByPath(context.path);if(!(file instanceof TFile))throw new Error('原笔记已移动或删除；草稿仍保留。请重新选择目标笔记。');
    const addition='\n\n## 我的理解\n\n'+text.trim()+'\n';
    const editorView=this.app.workspace.getLeavesOfType('markdown').map(leaf=>leaf.view).find((view):view is MarkdownView=>view instanceof MarkdownView&&view.file?.path===file.path);
    if(editorView){if(hash(editorView.editor.getValue())!==context.hash)throw new Error('笔记已有新内容。请更新笔记上下文后重新预览；理解草稿仍保留。');const editor=editorView.editor;const last=editor.lastLine();editor.replaceRange(addition,{line:last,ch:editor.getLine(last).length});}
    else await this.app.vault.process(file,current=>{if(hash(current)!==context.hash)throw new Error('笔记已有新内容，请更新上下文后重新预览。');return current+addition;});
  }
}
