// Follow streamed content only while the reader remains at the bottom.
export function watchChatScroll(viewport:HTMLElement,messages:HTMLElement,initialFollow:boolean){
  let following=initialFollow;
  const win=viewport.ownerDocument.defaultView!;
  const update=()=>{if(following)viewport.scrollTop=viewport.scrollHeight;};
  const onScroll=()=>{following=viewport.scrollHeight-viewport.scrollTop-viewport.clientHeight<48;};
  const observer=new win.ResizeObserver(update);
  observer.observe(messages);observer.observe(viewport);
  viewport.addEventListener('scroll',onScroll);
  update();
  return {get following(){return following;},stop(){observer.disconnect();viewport.removeEventListener('scroll',onScroll);}};
}

// Obsidian's floating status bar can cover the bottom of a workspace leaf.
// Measure the intersection so hidden bars and leaves above/beside it need no gap.
export function watchStatusBar(root:HTMLElement){
  const doc=root.ownerDocument;
  const win=doc.defaultView!;
  let bar:HTMLElement|null=null;
  let frame=0;
  let stopped=false;
  const refresh=()=>{
    if(stopped||frame)return;
    frame=win.requestAnimationFrame(()=>{
      frame=0;
      const current=doc.querySelector<HTMLElement>('.status-bar');
      if(current!==bar){if(bar)observer.unobserve(bar);bar=current;if(bar)observer.observe(bar);}
      const bounds=root.getBoundingClientRect();
      const overlay=bar?.getBoundingClientRect();
      const overlaps=overlay&&overlay.width>0&&overlay.height>0&&
        overlay.left<bounds.right&&overlay.right>bounds.left&&
        overlay.top<bounds.bottom&&overlay.bottom>bounds.top;
      // Rects include CSS zoom; padding is expressed in the element's CSS pixels.
      const scale=root.offsetHeight?bounds.height/root.offsetHeight:1;
      const inset=overlaps&&scale>0?Math.ceil((bounds.bottom-Math.max(bounds.top,overlay.top))/scale)+6:0;
      const value=inset+'px';
      if(root.style.getPropertyValue('--sc-bottom-inset')!==value)root.style.setProperty('--sc-bottom-inset',value);
    });
  };
  const observer=new win.ResizeObserver(refresh);
  observer.observe(root);
  win.addEventListener('resize',refresh);
  refresh();
  return {refresh,stop(){stopped=true;observer.disconnect();win.removeEventListener('resize',refresh);if(frame)win.cancelAnimationFrame(frame);root.style.removeProperty('--sc-bottom-inset');}};
}
