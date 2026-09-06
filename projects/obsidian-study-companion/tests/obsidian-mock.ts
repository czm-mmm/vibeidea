export class Component {load(){}unload(){}}
export class ItemView {
  app:any; contentEl:HTMLElement; leaf:any;
  constructor(leaf:any){this.leaf=leaf;this.app=leaf.app;this.contentEl=leaf.contentEl;}
  async setState(_state:any,_result:any){}
}
export class MarkdownView {}
export class TFile {}
export class Menu {
  private items:{title:string,action:()=>unknown}[]=[];
  addItem(build:(item:any)=>unknown){const entry={title:'',action:()=>{},setTitle(title:string){this.title=title;return this;},onClick(action:()=>unknown){this.action=action;return this;}};build(entry);this.items.push(entry);return this;}
  addSeparator(){return this;}
  showAtMouseEvent(_event:MouseEvent){this.showAtPosition();}
  showAtPosition(_position?:any){const menu=document.createElement('div');menu.setAttribute('role','menu');menu.style.cssText='position:fixed;top:40px;right:4px;background:white;z-index:100';for(const item of this.items){const button=document.createElement('button');button.setAttribute('role','menuitem');button.textContent=item.title;button.onclick=()=>{menu.remove();item.action();};menu.append(button);}document.body.append(menu);}
}
export class Modal {
  contentEl:HTMLElement;app:any;
  constructor(app:any){this.app=app;this.contentEl=document.createElement('div');}
  open(){(this as any).onOpen?.();document.body.appendChild(this.contentEl);}
  close(){this.contentEl.remove();}
}
export class Notice {constructor(text:string){(window as any).lastNotice=text;}}
export const MarkdownRenderer={async render(_app:any,text:string,target:HTMLElement){for(const paragraph of text.split(/\n\n+/)){const p=document.createElement('p');p.textContent=paragraph;target.appendChild(p);}}};
