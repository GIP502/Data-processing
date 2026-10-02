/* App composition: modules communicate through ProcessStore and confirmed Result snapshots. */
(() => {
  'use strict';
  const specs=[
    {title:'프로세스 설정 · Process Builder',icon:'process-builder',size:{width:1140,height:710}},
    {title:'데이터 분류 · Data Labeling',icon:'data-labeling',size:{width:1220,height:735}},
    {title:'결과 · Result',icon:'result',size:{width:1140,height:735}}
  ];
  const handles=new Map(),builder=ProcessBuilder.create(),results=ResultView.create();
  const labeling=DataLabeling.create({onProcessed(snapshot){results.setSnapshot(snapshot);openWindow(2).restore();}});
  function openWindow(index){
    const spec=specs[index];if(handles.has(spec.title))return handles.get(spec.title);
    let dispose;
    const handle=WindowManager.create({title:spec.title,iconPath:`assets/branding/${spec.icon}.png`,size:spec.size,mount(content){
      dispose=[builder,labeling,results][index].mount(content);
    },onClose(){dispose?.();handles.delete(spec.title);}});
    handles.set(spec.title,handle);return handle;
  }
  function openFrames(){specs.forEach((_,i)=>openWindow(i));openWindow(0).restore();}
  document.getElementById('newWindow').onclick=openFrames;
  document.getElementById('theme').onclick=()=>{
    const dark=document.body.classList.toggle('dark');document.body.classList.toggle('light',!dark);
    document.querySelector('#theme img').src=`assets/icons/${dark?'41-light-theme':'42-dark-theme'}.svg`;
  };
  openFrames();
})();
