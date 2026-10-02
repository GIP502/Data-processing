const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
function setup() {
  let seq=0, reduced=false;
  const timers=new Map(), nodes=[];
  const make=()=>{
    const events=new Map(), classes=new Set(), values=new Map();
    return {style:{zIndex:'12',setProperty:(k,v)=>values.set(k,v),removeProperty:k=>values.delete(k)},
      classes, values, offsetWidth:800,removed:false,
      classList:{add:k=>classes.add(k),remove:(...names)=>names.forEach(k=>classes.delete(k))},
      setAttribute(){},remove(){this.removed=true;},
      addEventListener:(k,fn)=>{if(!events.has(k))events.set(k,new Set());events.get(k).add(fn);},
      removeEventListener:(k,fn)=>events.get(k)?.delete(fn),
      emit(name){for(const fn of [...(events.get('animationend')||[])])fn({target:this,animationName:name});},
      animate(){return {cancel(){this.cancelled=true;}};},
    };
  };
  const context={window:{},document:{createElement:()=>{const n=make();nodes.push(n);return n;}},setTimeout:(fn,ms)=>{const id=++seq;timers.set(id,{fn,ms});return id;},clearTimeout:id=>timers.delete(id),getComputedStyle:()=>({transform:'matrix(1,0,0,1,0,0)'})};
  vm.createContext(context);vm.runInContext(fs.readFileSync('src/surface-motion.js','utf8'),context);
  const root=make(), desk={appendChild(){}}, rect={x:30,y:40,w:800,h:500};
  const motion=context.window.BDPSurfaceMotion.create({desk,reduced:()=>reduced});
  return {motion,root,rect,nodes,timers,setReduced:v=>reduced=v};
}
test('reopening cancels the pending minimize completion and removes its floor shadow',()=>{
  const {motion,root,rect,nodes,timers}=setup();let hidden=false,opened=0;
  motion.sink(root,rect,()=>hidden=true);
  const obsolete=[...timers.values()].filter(t=>t.ms===720);assert.equal(obsolete.length,1);
  motion.open(root,rect,()=>opened++);
  assert(nodes[0].removed);assert(root.classes.has('surface-opening'));assert(!root.classes.has('surface-sinking'));
  root.emit('surface-sink');assert.equal(hidden,false);
  root.emit('liquid-content');assert.equal(opened,0);
  root.emit('surface-rise');assert.equal(opened,1);assert.equal(hidden,false);
  assert(!root.classes.has('surface-opening'));
});
test('fallback completes exactly once; dispose cancels outstanding shadows',()=>{
  const {motion,root,rect,nodes,timers}=setup();let count=0;
  motion.open(root,rect,()=>count++);
  const finish=[...timers.values()].find(t=>t.ms===1380);assert(finish);finish.fn();
  root.emit('surface-rise');assert.equal(count,1);
  motion.dispose(root);assert(nodes.every(n=>n.removed));assert.equal(timers.size,0);
});
test('reduced motion completes synchronously without shadows or timers',()=>{
  const {motion,root,rect,nodes,timers,setReduced}=setup();setReduced(true);let count=0;
  motion.open(root,rect,()=>count++);motion.sink(root,rect,()=>count++);motion.drag(root,100,-100);motion.release(root);
  motion.ripple({x:100,y:100})();
  assert.equal(count,2);assert.equal(nodes.length,0);assert.equal(timers.size,0);assert.equal(root.classes.size,0);
});
test('drag stretch is bounded and a new operation cancels the rebound animation',()=>{
  const {motion,root,rect}=setup();motion.drag(root,100,-100);
  assert.equal(root.values.get('--liquid-tilt'),'1.3deg');assert(Number(root.values.get('--liquid-scale-x'))<1.04);
  assert.equal(root.values.get('--surface-lag-x'),'-28px');assert.equal(root.values.get('--surface-lag-y'),'20px');
  motion.release(root);assert(!root.classes.has('surface-drag'));assert(!root.values.has('--liquid-tilt'));
  assert(!root.values.has('--surface-lag-x'));assert(!root.values.has('--surface-lag-y'));
  motion.sink(root,rect);motion.dispose(root);assert.equal(root.classes.size,0);
});
test('Dock ripple survives a window opening and cleans up its own listener and timer',()=>{
  const {motion,root,rect,nodes,timers}=setup();
  const cleanup=motion.ripple({x:50,y:80});
  const wave=nodes[0];
  assert.equal(wave.style.left,'50px');assert.equal(wave.style.top,'80px');
  motion.open(root,rect);
  assert(!wave.removed);
  wave.emit('surface-rise');assert(!wave.removed);
  wave.emit('surface-ripple');assert(wave.removed);
  cleanup();motion.dispose(root);
  assert.equal(timers.size,0);
});
test('rapid Dock clicks keep at most four ripples and fallback removes all of them',()=>{
  const {motion,nodes,timers}=setup();
  for(let i=0;i<8;i++)motion.ripple({x:i,y:i});
  assert.equal(nodes.filter(n=>!n.removed).length,4);assert.equal(timers.size,4);
  for(const timer of [...timers.values()])timer.fn();
  assert(nodes.every(n=>n.removed));assert.equal(timers.size,0);
});

