
function legacyFresh(){const p=global.ProcessCore.fresh();p.version=1;p.tags=p.tags.map(t=>{const x={...t,kind:'range',row:'2',column:'2',endRow:'4',endColumn:'2'};for(const k of ['start','sheetMode','sheetIndex','endRowMode','endRowBy','endColumnMode','endColumnBy'])delete x[k];return x;});return p;}
const {test}=require('node:test');
const assert=require('node:assert/strict');
require('../src/process-core.js');
const C=global.ProcessCore;
const book={name:'sample.xlsx',sheets:[{name:'Sheet1',rows:[['name','value','factor'],['a',10,2],['b',20,3],['c',30,4]]}]};
test('default range tags produce expected three-row table',()=>{
  const result=C.evaluate(book,legacyFresh());assert.equal(result.classification.type.name,'유형 1');assert.deepEqual(result.rows,[['값'],[10],[20],[30]]);assert.deepEqual(result.errors,[]);
});
test('classification conflicts do not select a type or retain output',()=>{
  const config=legacyFresh();config.types.push({...config.types[0],id:'other',name:'other'});const result=C.evaluate(book,config);assert.equal(result.classification.status,'conflict');assert.equal(result.rows,null);
});
test('one-based cell, row, column and matrix extraction preserve values and shape',()=>{
  const base={...legacyFresh().tags[0],row:'2',column:'2',endRow:'3',endColumn:'3'};
  assert.deepEqual(C.extract(book,{...base,kind:'cell'}),[[10]]);
  assert.deepEqual(C.extract(book,{...base,kind:'row'}),[[10,2]]);
  assert.deepEqual(C.extract(book,{...base,kind:'column',endRow:''}),[[10],[20],[30]]);
  assert.deepEqual(C.extract(book,{...base,kind:'range'}),[[10,2],[20,3]]);
  assert.throws(()=>C.extract(book,{...base,row:'0'}),/1 以上|1 이상의/);
});
test('binary operations broadcast scalars but reject size mismatch, blanks and divide by zero',()=>{
  assert.deepEqual(C.compute([[10],[20]],'multiply',[[2]]),[[20],[40]]);
  assert.deepEqual(C.compute([[2]],'multiply',[[10],[20]]),[[20],[40]]);
  assert.throws(()=>C.compute([[1],[2]],'add',[[1],[2],[3]]),/크기|개수/);
  assert.throws(()=>C.compute([[null]],'multiply',[[2]]),/빈값/);
  assert.throws(()=>C.compute([[1]],'divide',[[0]]),/0으로/);
});
test('dependent computed tags resolve out of order; cycles fail without output',()=>{
  const config=legacyFresh();config.steps=[{input:'doubled',op:'sum',result:'total'},{input:'값',op:'multiply',rightKind:'number',right:'2',result:'doubled'}];config.output.columns[0].tag='total';assert.deepEqual(C.evaluate(book,config).rows,[['값'],[120]]);
  config.steps=[{input:'b',op:'none',result:'a'},{input:'a',op:'none',result:'b'}];assert.match(C.evaluate(book,config).errors.join(''),/순환/);
});
test('positioned output retains matrix shape and rejects overlapping placements',()=>{
  const tags=new Map([['grid',[[1,2],[3,4]]]]);assert.deepEqual(C.output(tags,{kind:'position',columns:[{tag:'grid',target:'B2'}]}),[[null,null,null],[null,1,2],[null,3,4]]);
  assert.throws(()=>C.output(tags,{kind:'position',columns:[{tag:'grid',target:'B2'},{tag:'grid',target:'C3'}]}),/겹칩니다/);
});
test('output rejects unequal list length and raw matrix in a table column',()=>{
  assert.throws(()=>C.output(new Map([['a',[[1],[2]]],['b',[[1],[2],[3]]]]),{kind:'table',columns:[{label:'a',tag:'a'},{label:'b',tag:'b'}]}),/길이|개수/);
  assert.throws(()=>C.output(new Map([['grid',[[1,2],[3,4]]]]),{kind:'table',columns:[{label:'grid',tag:'grid'}]}),/열 번호/);
});
test('identical original tag names are allowed in distinct file types',()=>{
  const config=legacyFresh();config.types.push({id:'type-2',name:'유형 2',mode:'all',conditions:[{kind:'filename',value:'other',operator:'contains'}]});config.tags.push({...config.tags[0],id:'tag-2',type:'type-2'});assert.deepEqual(C.validate(config),[]);
});
test('type-scoped calculations do not run against unrelated file types',()=>{
  const config=legacyFresh();config.types.push({id:'other',name:'다른 유형',mode:'all',conditions:[{kind:'filename',value:'other',operator:'contains'}]});
  config.steps.push({type:'other',input:'다른값',op:'none',result:'다른결과'});assert.deepEqual(C.evaluate(book,config).errors,[]);
});
