const {test}=require('node:test');
const assert=require('node:assert/strict');
require('../src/process-core.js');
const C=global.ProcessCore;
const book={name:'2_main_there.xlsx',sheets:[{name:'Sheet1',rows:[['name','value','factor','note'],['a',10,2,'x'],['b',20,3,'y'],['c',30,4,'z'],['d',null,5,'q']]}]};

test('default dynamic List produces rows through the last value in its anchor column',()=>{
  const result=C.evaluate(book,C.fresh());assert.equal(result.classification.type.name,'유형 1');assert.deepEqual(result.rows,[['값'],[10],[20],[30]]);assert.deepEqual(result.errors,[]);
});

test('filename token classification supports delimiter + Nth token',()=>{
  const config=C.fresh();config.types[0].conditions=[{kind:'filename-token',delimiter:'_',part:'2',operator:'equals',value:'main'}];
  const result=C.classify(book,config);assert.equal(result.status,'matched');assert.equal(result.type.name,'유형 1');
});

test('classification conflicts do not select a type or retain output',()=>{
  const config=C.fresh();config.types.push({...config.types[0],id:'other',name:'other'});const result=C.evaluate(book,config);assert.equal(result.classification.status,'conflict');assert.equal(result.rows,null);
});

test('Value, List and Table extraction preserve shape with fixed ranges',()=>{
  const base={...C.fresh().tags[0],start:'B2',endRow:'3',endColumn:'3',endRowMode:'fixed',endColumnMode:'fixed'};
  assert.deepEqual(C.extract(book,{...base,kind:'cell'}),[[10]]);
  assert.deepEqual(C.extract(book,{...base,kind:'row'}),[[10,2]]);
  assert.deepEqual(C.extract(book,{...base,kind:'column'}),[[10],[20]]);
  assert.deepEqual(C.extract(book,{...base,kind:'range'}),[[10,2],[20,3]]);
  assert.throws(()=>C.extract(book,{...base,start:'B0'}),/셀 주소/);
});

test('dynamic ranges support last-data and until-blank anchors',()=>{
  const base={...C.fresh().tags[0],kind:'column',start:'B2',endRowBy:'B'};
  assert.deepEqual(C.extract(book,{...base,endRowMode:'last-data'}),[[10],[20],[30]]);
  assert.deepEqual(C.extract(book,{...base,endRowMode:'until-blank'}),[[10],[20],[30]]);
  const table={...base,kind:'range',endRowMode:'last-data',endRowBy:'A',endColumnMode:'last-data',endColumnBy:'2'};
  assert.deepEqual(C.extract(book,table),[[10,2,'x'],[20,3,'y'],[30,4,'z'],[null,5,'q']]);
});

test('binary operations broadcast Value, align Lists by position, and reject mismatches',()=>{
  assert.deepEqual(C.compute([[10],[20]],'multiply',[[2]]),[[20],[40]]);
  assert.deepEqual(C.compute([[2]],'multiply',[[10,20]]),[[20,40]]);
  assert.deepEqual(C.compute([[1,2]],'add',[[10],[20]]),[[11,22]]);
  assert.throws(()=>C.compute([[1],[2]],'add',[[1],[2],[3]]),/개수/);
  assert.throws(()=>C.compute([[null]],'multiply',[[2]]),/빈값/);
  assert.throws(()=>C.compute([[1]],'divide',[[0]]),/0으로/);
});

test('dependent calculated data resolves out of order; cycles fail without output',()=>{
  const config=C.fresh();config.steps=[{input:'doubled',op:'sum',result:'total'},{input:'값',op:'multiply',rightKind:'number',right:'2',result:'doubled'}];config.output.columns[0].tag='total';assert.deepEqual(C.evaluate(book,config).rows,[['값'],[120]]);
  config.steps=[{input:'b',op:'none',result:'a'},{input:'a',op:'none',result:'b'}];assert.match(C.evaluate(book,config).errors.join(''),/순환/);
});

test('positioned output retains full Table shape and rejects overlap',()=>{
  const tags=new Map([['grid',[[1,2],[3,4]]]]);assert.deepEqual(C.output(tags,{kind:'position',columns:[{tag:'grid',target:'B2'}]}),[[null,null,null],[null,1,2],[null,3,4]]);
  assert.throws(()=>C.output(tags,{kind:'position',columns:[{tag:'grid',target:'B2'},{tag:'grid',target:'C3'}]}),/겹칩니다/);
});

test('Result Table repeats Value, accepts row or column Lists, and rejects unequal List lengths',()=>{
  assert.deepEqual(C.output(new Map([['name',[['A']]],['qty',[[1,2,3]]]]),{kind:'table',columns:[{label:'name',tag:'name'},{label:'qty',tag:'qty'}]}),[['name','qty'],['A',1],['A',2],['A',3]]);
  assert.throws(()=>C.output(new Map([['a',[[1],[2]]],['b',[[1],[2],[3]]]]),{kind:'table',columns:[{label:'a',tag:'a'},{label:'b',tag:'b'}]}),/개수/);
});

test('Result Table requires a selected column for Table data',()=>{
  const tags=new Map([['grid',[[1,10],[2,20],[3,30]]]]);
  assert.throws(()=>C.output(tags,{kind:'table',columns:[{label:'grid',tag:'grid'}]}),/열 번호/);
  assert.deepEqual(C.output(tags,{kind:'table',columns:[{label:'value',tag:'grid',tableColumn:'2'}]}),[['value'],[10],[20],[30]]);
});

test('identical original data names are allowed in distinct file types',()=>{
  const config=C.fresh();config.types.push({id:'type-2',name:'유형 2',mode:'all',conditions:[{kind:'filename',value:'other',operator:'contains'}]});config.tags.push({...config.tags[0],id:'data-2',type:'type-2'});assert.deepEqual(C.validate(config),[]);
});

test('type-scoped calculations do not run against unrelated file types',()=>{
  const config=C.fresh();config.types.push({id:'other',name:'다른 유형',mode:'all',conditions:[{kind:'filename',value:'other',operator:'contains'}]});
  config.steps.push({type:'other',input:'다른값',op:'none',result:'다른결과'});assert.deepEqual(C.evaluate(book,config).errors,[]);
});
