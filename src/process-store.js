/* Shared saved-Process contract. Never stores workbooks or review edits. */
window.ProcessStore=(()=>{
  'use strict';
  const KEY='WindowStarter.Processes.v1',DEFAULT='WindowStarter.DefaultProcess.v1',listeners=new Set();
  const copy=x=>JSON.parse(JSON.stringify(x));
  function list(){
    try{const all=JSON.parse(localStorage.getItem(KEY)||'[]');return Array.isArray(all)?all.filter(p=>[1,2].includes(p?.version)&&Array.isArray(p.types)&&Array.isArray(p.tags)&&Array.isArray(p.steps)&&Array.isArray(p.output?.columns)).map(ProcessCore.normalize):[];}catch(_){return [];}
  }
  function changed(){for(const fn of listeners)fn();}
  function save(process){const p=ProcessCore.normalize(process);p.id ||= globalThis.crypto?.randomUUID?.()||'process-'+Date.now();const next=list().filter(x=>x.id!==p.id);next.push(p);localStorage.setItem(KEY,JSON.stringify(next));changed();return p;}
  function subscribe(fn){listeners.add(fn);return ()=>listeners.delete(fn);}
  function defaultId(){try{return localStorage.getItem(DEFAULT)||'';}catch(_){return '';}}
  function setDefault(id){localStorage.setItem(DEFAULT,id);changed();}
  addEventListener('storage',e=>{if(e.key===KEY||e.key===DEFAULT)changed();});
  return Object.freeze({list,save,subscribe,defaultId,setDefault});
})();
