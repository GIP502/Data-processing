/* Public contract: create({title, mount(content, handle), onClose()}) -> {close,minimize,restore,toggleMaximize,content}. */
window.WindowManager = (() => {
  'use strict';
  const windows = new Set();
  let layer = 1, serial = 0;
  const area = document.getElementById('windows');
  const dock = document.getElementById('windowList');
  const desk = document.getElementById('desktop');
  const reduced = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
  const css = getComputedStyle(document.body);
  const timing = (name, fallback) => parseFloat(css.getPropertyValue(name)) || fallback;
  const motion = BDPSurfaceMotion.create({desk, reduced, timing:{
    wait:timing('--surface-wait',160),rise:timing('--surface-rise',1120),
    sink:timing('--surface-sink',620),ripple:timing('--surface-ripple-duration',420)
  }});
  document.querySelector('.dock').addEventListener('click', event => {
    const button=event.target.closest('button');if(!button)return;
    const r=button.getBoundingClientRect(),d=desk.getBoundingClientRect();
    motion.ripple({x:(event.detail?event.clientX:r.left+r.width/2)-d.left,y:(event.detail?event.clientY:r.top+r.height/2)-d.top});
  });
  const icon = name => `assets/icons/${name}.svg`;
  function bounds() { return { width: innerWidth, height: Math.max(1, innerHeight - 64) }; }
  function focus(win) {
    windows.forEach(item => item.el.classList.toggle('inactive', item !== win));
    win.el.style.zIndex = (layer += 2);
  }
  function fit(win) {
    const b = bounds();
    if (win.max) win.rect = { x: 8, y: 8, w: Math.max(1,b.width-16), h: Math.max(1,b.height-16) };
    else {
      win.rect.w = Math.min(win.rect.w,b.width); win.rect.h = Math.min(win.rect.h,b.height);
      win.rect.x = Math.max(0,Math.min(win.rect.x,b.width-win.rect.w));
      win.rect.y = Math.max(0,Math.min(win.rect.y,b.height-win.rect.h));
    }
    const r=win.rect;
    Object.assign(win.el.style,{left:r.x+'px',top:r.y+'px',width:r.w+'px',height:r.h+'px'});
  }
  function create({title='새 창', iconPath='assets/branding/app-icon-original.png', size={width:760,height:480}, mount=()=>{}, onClose=()=>{}}={}) {
    const number=++serial;
    const el=document.createElement('section'); el.className='win'; el.setAttribute('aria-label',title);
    el.innerHTML='<header class="titlebar"><strong></strong><div class="controls"></div></header><div class="window-content"></div><div class="resize" aria-hidden="true"></div>';
    el.querySelector('strong').textContent=title;
    const titleIcon=document.createElement('img');titleIcon.className='window-title-icon';titleIcon.src=iconPath;titleIcon.alt='';el.querySelector('.titlebar').prepend(titleIcon);
    const item=document.createElement('button'); item.title=title; item.setAttribute('aria-label',title+' 복원');
    const image=document.createElement('img'); image.src=iconPath; image.alt=''; item.append(image);
    const win={el,item,max:false,closing:false,min:false,rectTimer:null,rect:{x:48+(number%6)*24,y:70+(number%6)*20,w:size.width,h:size.height}};
    const handle={
      content:el.querySelector('.window-content'),
      close(){
        if(win.closing)return;win.closing=true;clearTimeout(win.rectTimer);el.classList.remove('anim-rect');
        const finish=()=>{motion.dispose(el);windows.delete(win);el.remove();item.remove();const last=[...windows].filter(w=>!w.el.hidden&&!w.closing).sort((a,b)=>+a.el.style.zIndex-+b.el.style.zIndex).pop();if(last)focus(last);onClose();};
        if(el.hidden)finish();else motion.sink(el,{...win.rect},finish);
      },
      minimize(){
        if(win.closing||win.min)return;win.min=true;clearTimeout(win.rectTimer);el.classList.remove('anim-rect');
        item.classList.add('minimized');motion.sink(el,{...win.rect},()=>{el.hidden=true;});
      },
      restore(){
        if(win.closing)return;const reopening=win.min||el.hidden;win.min=false;el.hidden=false;
        item.classList.remove('minimized');focus(win);fit(win);if(reopening)motion.open(el,{...win.rect});
      },
      toggleMaximize(){
        if(win.closing||win.min)return;motion.cancel(el);clearTimeout(win.rectTimer);
        if(!win.max)win.saved={...win.rect};win.max=!win.max;if(!win.max)win.rect={...win.saved};
        el.classList.toggle('maximized',win.max);el.classList.add('anim-rect');fit(win);
        win.rectTimer=setTimeout(()=>el.classList.remove('anim-rect'),timing('--dur-slow',400)+50);
      }
    };
    [['07-minimize','최소화',handle.minimize],['08-maximize','최대화 / 복원',handle.toggleMaximize],['10-close','닫기',handle.close]].forEach(([file,label,action])=>{
      const btn=document.createElement('button');btn.className='control';btn.title=label;btn.setAttribute('aria-label',label);
      const img=document.createElement('img');img.src=icon(file);img.alt='';btn.append(img);btn.onclick=action;el.querySelector('.controls').append(btn);
    });
    item.onclick=handle.restore; el.addEventListener('pointerdown',()=>focus(win));
    const bar=el.querySelector('.titlebar');bar.addEventListener('dblclick',e=>{if(!e.target.closest('button'))handle.toggleMaximize();});
    function gesture(target,resizing) {
      target.addEventListener('pointerdown',e=>{
        if(e.button!==0||win.max||win.closing||win.min||el.classList.contains('surface-opening')||e.target.closest('button'))return;
        clearTimeout(win.rectTimer);el.classList.remove('anim-rect');
        e.preventDefault();target.setPointerCapture(e.pointerId);
        const start={x:e.clientX,y:e.clientY,rect:{...win.rect}};
        let last={x:e.clientX,y:e.clientY,time:performance.now()};
        function move(event){
          const now=performance.now(),dt=Math.max(1,now-last.time);
          if(!resizing)motion.drag(el,(event.clientX-last.x)/dt,(event.clientY-last.y)/dt);
          last={x:event.clientX,y:event.clientY,time:now};const dx=event.clientX-start.x,dy=event.clientY-start.y;
          win.rect=resizing?{...start.rect,w:Math.max(280,start.rect.w+dx),h:Math.max(180,start.rect.h+dy)}:{...start.rect,x:start.rect.x+dx,y:start.rect.y+dy};fit(win);}
        function end(){if(!resizing)motion.release(el);target.removeEventListener('pointermove',move);target.removeEventListener('pointerup',end);target.removeEventListener('pointercancel',end);target.removeEventListener('lostpointercapture',end);}
        target.addEventListener('pointermove',move);target.addEventListener('pointerup',end);target.addEventListener('pointercancel',end);target.addEventListener('lostpointercapture',end);
      });
    }
    gesture(bar,false);gesture(el.querySelector('.resize'),true);
    windows.add(win);area.append(el);dock.append(item);fit(win);focus(win);
    try{mount(handle.content,handle);}catch(error){handle.close();throw error;}
    motion.open(el,{...win.rect});
    return handle;
  }
  addEventListener('resize',()=>windows.forEach(fit));
  return Object.freeze({create});
})();




