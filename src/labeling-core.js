/* Pure review rules; corrections belong to an entry, never to source workbooks or the Process. */
(function(global){
  'use strict';
  const STATUS={normal:'정상',review:'확인 필요',unmatched:'미분류',error:'오류',reading:'분석 중',waiting:'Process 선택 필요'};
  const copy=x=>JSON.parse(JSON.stringify(x));
  function analyze(entry,process){
    if(entry.readError)return {status:'error',errors:[entry.readError],warnings:[],tags:new Map(),rows:null,classification:null};
    if(!entry.book)return {status:'reading',errors:[],warnings:[],tags:new Map(),rows:null,classification:null};
    if(!process)return {status:'waiting',errors:[],warnings:[],tags:new Map(),rows:null,classification:null};
    const result=ProcessCore.evaluate(entry.book,process,{typeId:entry.typeId,values:entry.overrides});
    result.errors.push(...Object.values(entry.editErrors||{}));
    const warnings=[];let status='normal';
    if(!result.classification.type){status=result.classification.status==='conflict'?'review':'unmatched';return {...result,status,warnings:status==='review'?[result.classification.reason]:[],errors:[]};}
    for(const [name,values] of result.tags){
      if(values.flat().some(v=>v===null||v===''))warnings.push(name+': 비어 있는 값이 있습니다.');
      const definition=process.tags.find(t=>t.type===result.classification.type.id&&t.name===name);
      if(!definition)continue;
      for(const [key,label,test] of [['min','최솟값',(n,b)=>n<b],['max','최댓값',(n,b)=>n>b]]){
        if(definition[key]!==undefined&&definition[key]!==''){
          const bound=Number(definition[key]);if(!Number.isFinite(bound)){result.errors.push(name+': 검수 '+label+'이 숫자가 아닙니다.');continue;}
          if(values.flat().some(v=>v!==null&&v!==''&&Number.isFinite(Number(v))&&test(Number(v),bound)))warnings.push(name+': 설정한 '+label+' '+bound+'을 벗어났습니다.');
        }
      }
      if(definition.review==='always')warnings.push(name+': Process에서 확인 대상으로 지정했습니다.');
    }
    if(result.errors.length){status='error';result.rows=null;}else if(warnings.length)status='review';
    return {...result,status,warnings};
  }
  function columns(process){return process?[...new Set([...process.tags.map(t=>t.name),...process.steps.map(s=>s.result)].filter(Boolean))]:[];}
  function parseValue(text,format='auto'){
    if(text==='')return null;if(format==='text')return text;
    if(format==='number'){const n=Number(text);if(!Number.isFinite(n))throw Error('숫자로 입력해 주세요.');return n;}
    if(/^[+-]?(?:\d+\.?\d*|\.\d+)(?:e[+-]?\d+)?$/i.test(text.trim())){const n=Number(text);if(!Number.isFinite(n))throw Error('숫자 표현 범위를 벗어났습니다.');return n;}return text;
  }
  function parseGrid(text,format='auto'){
    let rows;if(text.trim().startsWith('[')){try{rows=JSON.parse(text);}catch(_){throw Error('배열 형식을 확인하세요.');}}
    else rows=text.replace(/\r/g,'').split('\n').map(r=>r.split('\t').map(v=>parseValue(v,format)));
    if(!Array.isArray(rows)||!rows.length||!rows.every(r=>Array.isArray(r)&&r.length&&r.length===rows[0].length))throw Error('각 행의 열 개수가 같아야 합니다.');
    if(rows.length*rows[0].length>10000)throw Error('수정값은 10,000셀까지 입력할 수 있습니다.');
    return rows.map(r=>r.map(v=>v===null?null:parseValue(String(v),format)));
  }
  function gate(entries){
    const active=entries.filter(e=>e.included!==false),busy=active.some(e=>['reading','waiting'].includes(e.result.status));
    const ready=active.filter(e=>e.result.rows&&!e.result.errors.length&&(e.result.status==='normal'||e.acknowledged));
    const warnings=active.filter(e=>e.result.status==='review'&&e.result.rows&&!e.acknowledged);
    const blocked=active.filter(e=>!e.result.rows||e.result.errors.length);
    return {active,ready,warnings,blocked,busy};
  }
  function snapshot(entries,process,{allowWarnings=false}={}){
    const state=gate(entries);if(state.busy)throw Error('파일 분석이 끝난 뒤 처리해 주세요.');
    if(process.processingPolicy==='block'&&(state.blocked.length||state.warnings.length))throw Error('이 Process는 모든 포함 파일의 분류·오류·확인이 해결되어야 처리할 수 있습니다.');
    const selected=entries.filter(e=>e.included!==false&&e.result.rows&&!e.result.errors.length&&(process.processingPolicy==='normalOnly'?e.result.status==='normal':e.result.status==='normal'||e.acknowledged||allowWarnings));
    if(!selected.length)throw Error('처리할 수 있는 파일이 없습니다.');
    const result={id:globalThis.crypto?.randomUUID?.()||'run-'+Date.now(),createdAt:new Date().toISOString(),process:copy(process),files:selected.map(e=>({id:e.id,name:e.name,type:e.result.classification.type.name,manualType:!!e.typeId,editedTags:Object.keys(e.overrides),warnings:copy(e.result.warnings),tags:Object.fromEntries([...e.result.tags].map(([n,v])=>[n,copy(v)])),rows:copy(e.result.rows)})),skipped:entries.filter(e=>!selected.includes(e)).map(e=>({name:e.name,reason:e.included===false?'사용자 제외':STATUS[e.result.status]}))};
    if(process.output.kind==='table'){
      const header=result.files[0].rows[0];if(result.files.some(f=>JSON.stringify(f.rows[0])!==JSON.stringify(header)))throw Error('파일별 출력 열 구성이 다릅니다.');
      result.rows=[header,...result.files.flatMap(f=>f.rows.slice(1))];
    }else result.rows=null;
    return result;
  }
  global.LabelingCore=Object.freeze({STATUS,analyze,columns,parseValue,parseGrid,gate,snapshot});
})(typeof window!=='undefined'?window:globalThis);
