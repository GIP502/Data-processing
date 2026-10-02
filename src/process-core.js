/* Pure Process contract. Workbook: {name,sheets:[{name,rows:[][]}]}. Coordinates are 1-based. */
(function(global){
  'use strict';
  const LIMIT=10000;
  const fresh=()=>({
    version:2,id:'',name:'새 Process',
    types:[{id:'type-1',name:'유형 1',mode:'all',conditions:[{kind:'filename',operator:'contains',value:'.xlsx',delimiter:'_',part:'1',sheetMode:'name',sheet:'Sheet1',sheetIndex:'1',address:'A1'}]}],
    tags:[{id:'data-1',type:'type-1',name:'값',sheetMode:'name',sheet:'Sheet1',sheetIndex:'1',kind:'column',start:'B2',row:'2',column:'2',endRow:'',endColumn:'',endRowMode:'last-data',endRowBy:'B',endColumnMode:'fixed',endColumnBy:'2',format:'auto'}],
    steps:[],
    output:{kind:'table',columns:[{id:'out-1',label:'값',tag:'값',tableColumn:'',target:'A1'}]}
  });
  const clone=x=>JSON.parse(JSON.stringify(x));
  function normalize(raw){
    const c=clone(raw&&typeof raw==='object'?raw:fresh());
    c.version=2;c.id=c.id||'';c.name=typeof c.name==='string'?c.name:'새 Process';
    c.types=Array.isArray(c.types)?c.types:clone(fresh().types);
    c.tags=Array.isArray(c.tags)?c.tags:[];c.steps=Array.isArray(c.steps)?c.steps:[];
    c.output=c.output&&typeof c.output==='object'?c.output:{kind:'table',columns:[]};
    c.output.kind=c.output.kind==='position'?'position':'table';c.output.columns=Array.isArray(c.output.columns)?c.output.columns:[];
    c.types.forEach((t,ti)=>{
      t.id=t.id||'type-'+(ti+1);t.name=typeof t.name==='string'?t.name:'유형 '+(ti+1);t.mode=t.mode==='any'?'any':'all';
      t.conditions=Array.isArray(t.conditions)?t.conditions:[{kind:'filename',operator:'contains',value:''}];
      t.conditions.forEach(cond=>{cond.kind=cond.kind||'filename';cond.operator=cond.operator||'contains';cond.value=String(cond.value??'');cond.delimiter=cond.delimiter??'_';cond.part=String(cond.part??'1');cond.sheetMode=cond.sheetMode==='index'?'index':'name';cond.sheet=cond.sheet||'Sheet1';cond.sheetIndex=String(cond.sheetIndex??'1');cond.address=cond.address||'A1';});
    });
    c.tags.forEach((t,ti)=>{
      t.id=t.id||'data-'+(ti+1);t.type=t.type||c.types[0]?.id||'';t.name=String(t.name??'');t.sheetMode=t.sheetMode==='index'?'index':'name';t.sheet=String(t.sheet??'Sheet1');t.sheetIndex=String(t.sheetIndex??'1');
      t.kind=['cell','row','column','range'].includes(t.kind)?t.kind:'cell';t.format=['auto','number','text'].includes(t.format)?t.format:'auto';
      t.row=String(t.row??'1');t.column=String(t.column??'1');t.start=t.start||safeAddress(t.row,t.column);
      if(t.start){try{const a=address(t.start);t.row=String(a.row);t.column=String(a.column);}catch(_){}}
      t.endRow=String(t.endRow??'');t.endColumn=String(t.endColumn??'');
      t.endRowMode=t.endRowMode||((t.kind==='column'&&t.endRow==='')?'sheet-end':'fixed');
      t.endColumnMode=t.endColumnMode||((t.kind==='row'&&t.endColumn==='')?'sheet-end':'fixed');
      if(!['fixed','last-data','until-blank','sheet-end'].includes(t.endRowMode))t.endRowMode='fixed';
      if(!['fixed','last-data','until-blank','sheet-end'].includes(t.endColumnMode))t.endColumnMode='fixed';
      t.endRowBy=String(t.endRowBy??colName(Number(t.column)||1));t.endColumnBy=String(t.endColumnBy??t.row??'1');
    });
    c.steps.forEach((s,si)=>{s.id=s.id||'calc-'+(si+1);s.type=s.type||'*';s.input=String(s.input??'');s.op=s.op||'none';s.rightKind=s.rightKind==='tag'?'tag':'number';s.right=String(s.right??'1');s.result=String(s.result??'');});
    c.output.columns.forEach((o,oi)=>{o.id=o.id||'out-'+(oi+1);o.label=String(o.label??'');o.tag=String(o.tag??'');o.tableColumn=String(o.tableColumn??'');o.target=o.target||'A1';});
    return c;
  }
  function safeAddress(row,column){const r=Number(row),c=Number(column);return Number.isInteger(r)&&r>0&&Number.isInteger(c)&&c>0?colName(c)+r:'INVALID('+row+','+column+')';}
  function integer(value,label){const n=Number(value);if(!Number.isInteger(n)||n<1)throw Error(label+'은 1 이상의 정수여야 합니다.');return n;}
  function colName(n){let s='';n=Number(n);if(!Number.isInteger(n)||n<1)return 'A';while(n){n--;s=String.fromCharCode(65+n%26)+s;n=Math.floor(n/26);}return s;}
  function columnNumber(value,label='열'){const s=String(value??'').trim();if(/^\d+$/.test(s))return integer(s,label);if(!/^[A-Z]+$/i.test(s))throw Error(label+'은 A, B 또는 1, 2 형식으로 입력하세요.');let n=0;for(const ch of s.toUpperCase())n=n*26+ch.charCodeAt(0)-64;return n;}
  function address(text){const m=/^([A-Z]+)([1-9]\d*)$/i.exec(String(text).trim());if(!m)throw Error('셀 주소를 확인하세요: '+text);return {row:Number(m[2]),column:columnNumber(m[1])};}
  function sheet(book,name){const s=book.sheets.find(x=>x.name===name);if(!s)throw Error('시트를 찾을 수 없습니다: '+name);return s;}
  function sheetAt(book,index){const n=integer(index,'시트 번호'),s=book.sheets[n-1];if(!s)throw Error(n+'번째 시트를 찾을 수 없습니다.');return s;}
  function resolveSheet(book,ref){return ref?.sheetMode==='index'?sheetAt(book,ref.sheetIndex):sheet(book,ref.sheet);}
  const cell=(s,r,c)=>s.rows[r-1]?.[c-1]??null;
  const blank=v=>v===null||v==='';
  function compare(value,operator,wanted){const a=String(value??''),b=String(wanted??'');if(operator==='equals')return a===b;if(operator==='not-equals')return a!==b;if(operator==='not-contains')return !a.includes(b);if(operator==='starts')return a.startsWith(b);if(operator==='ends')return a.endsWith(b);return a.includes(b);}
  function classify(book,rawConfig){
    const config=normalize(rawConfig),matches=[],reasons=[],errors=[];
    for(const t of config.types){
      const checks=t.conditions.map(c=>{try{
        let values,label='';
        if(c.kind==='filename-token'){
          const base=book.name.replace(/\.[^.]+$/,'');const delimiter=String(c.delimiter??'_');if(!delimiter)throw Error('파일명 구분자를 입력하세요.');const part=integer(c.part,'파일명 위치');values=[base.split(delimiter)[part-1]??''];label=`파일명 ${part}번째`;
        }else if(c.kind==='filename'){values=[book.name];label='파일명';}
        else if(c.kind==='sheet'){values=book.sheets.map(s=>s.name);label='시트명';}
        else {const a=address(c.address);values=[cell(resolveSheet(book,c),a.row,a.column)];label='셀 값';}
        if(!String(c.value).trim()&&['contains','equals','starts','ends'].includes(c.operator))return false;
        const ok=values.some(v=>compare(v,c.operator,c.value));return ok;
      }catch(e){errors.push(t.name+': '+e.message);return false;}});
      const ok=checks.length>0&&(t.mode==='any'?checks.some(Boolean):checks.every(Boolean));
      if(ok){matches.push(t);reasons.push(t.conditions.filter((_,i)=>checks[i]).map(c=>({filename:'파일명','filename-token':'파일명 위치',sheet:'시트명',cell:'셀 값'}[c.kind]||'조건')+': '+c.value).join(' · '));}
    }
    return {type:matches.length===1?matches[0]:null,status:matches.length===1?'matched':matches.length?'conflict':'unmatched',reason:matches.length===1?reasons[0]:matches.length?'여러 유형에 일치합니다: '+matches.map(x=>x.name).join(', '):errors[0]||'일치하는 분류 조건이 없습니다.'};
  }
  function lastDataRow(s,start,anchor){for(let r=s.rows.length;r>=start;r--)if(!blank(cell(s,r,anchor)))return r;throw Error('마지막 행을 찾을 기준 열에 데이터가 없습니다.');}
  function untilBlankRow(s,start,anchor){if(blank(cell(s,start,anchor)))throw Error('가져오기를 시작할 셀이 비어 있습니다.');let r=start;while(r<=s.rows.length&&!blank(cell(s,r,anchor)))r++;return r-1;}
  function lastDataColumn(s,start,anchorRow){const row=s.rows[anchorRow-1]||[];for(let c=row.length;c>=start;c--)if(!blank(cell(s,anchorRow,c)))return c;throw Error('마지막 열을 찾을 기준 행에 데이터가 없습니다.');}
  function untilBlankColumn(s,start,anchorRow){if(blank(cell(s,anchorRow,start)))throw Error('가져오기를 시작할 셀이 비어 있습니다.');let c=start,max=(s.rows[anchorRow-1]||[]).length;while(c<=max&&!blank(cell(s,anchorRow,c)))c++;return c-1;}
  function resolveEndRow(s,tag,startRow,startColumn){if(tag.endRowMode==='sheet-end'||(!tag.endRowMode&&tag.endRow===''))return Math.max(startRow,s.rows.length);if(tag.endRowMode==='last-data')return lastDataRow(s,startRow,columnNumber(tag.endRowBy||startColumn,'기준 열'));if(tag.endRowMode==='until-blank')return untilBlankRow(s,startRow,columnNumber(tag.endRowBy||startColumn,'기준 열'));return integer(tag.endRow,'마지막 행');}
  function resolveEndColumn(s,tag,startRow,startColumn){if(tag.endColumnMode==='sheet-end'||(!tag.endColumnMode&&tag.endColumn===''))return Math.max(startColumn,s.rows.reduce((n,r)=>Math.max(n,r.length),0));if(tag.endColumnMode==='last-data')return lastDataColumn(s,startColumn,integer(tag.endColumnBy||startRow,'기준 행'));if(tag.endColumnMode==='until-blank')return untilBlankColumn(s,startColumn,integer(tag.endColumnBy||startRow,'기준 행'));return integer(tag.endColumn,'마지막 열');}
  function extract(book,rawTag){
    const tag={...rawTag},s=resolveSheet(book,tag);let start;
    try{start=tag.start?address(tag.start):{row:integer(tag.row,'행'),column:integer(tag.column,'열')};}catch(e){throw Error((tag.name?tag.name+': ':'')+e.message);}
    const r=start.row,c=start.column;let r2=r,c2=c;
    if(tag.kind==='row')c2=resolveEndColumn(s,tag,r,c);
    if(tag.kind==='column')r2=resolveEndRow(s,tag,r,c);
    if(tag.kind==='range'){r2=resolveEndRow(s,tag,r,c);c2=resolveEndColumn(s,tag,r,c);}
    if(r2<r||c2<c)throw Error(tag.name+': 끝 위치는 시작 위치 이상이어야 합니다.');
    if((r2-r+1)*(c2-c+1)>LIMIT)throw Error(tag.name+': 미리보기 범위는 10,000셀까지 지원합니다.');
    if(r>s.rows.length||c>s.rows.reduce((n,x)=>Math.max(n,x.length),0))throw Error(tag.name+': 시작 위치가 데이터 영역 밖입니다.');
    const values=[];
    for(let y=r;y<=r2;y++){const line=[];for(let x=c;x<=c2;x++){let v=cell(s,y,x);
      if(v&&typeof v==='object'&&v.error)throw Error(tag.name+': Excel 셀 오류 ('+colName(x)+y+'): '+v.error);
      if(tag.format==='number'&&!blank(v)){const n=Number(v);if(!Number.isFinite(n))throw Error(tag.name+': 숫자로 읽을 수 없는 값 ('+colName(x)+y+')');v=n;}
      if(tag.format==='text'&&v!==null)v=String(v);line.push(v);
    }values.push(line);}return values;
  }
  function finite(n){if(!Number.isFinite(n))throw Error('계산 결과가 숫자 표현 범위를 벗어났습니다.');return n;}
  function numeric(v){if(blank(v)||typeof v==='boolean')throw Error('빈값 또는 숫자가 아닌 값은 계산할 수 없습니다.');const n=Number(v);if(!Number.isFinite(n))throw Error('숫자가 아닌 값은 계산할 수 없습니다.');return n;}
  function shape(data){const rows=data.length,cols=Math.max(0,...data.map(r=>r.length));if(rows===1&&cols===1)return {kind:'value',rows,cols,length:1};if(rows===1||cols===1)return {kind:'list',rows,cols,length:Math.max(rows,cols)};return {kind:'table',rows,cols,length:rows*cols};}
  function listValues(data){const s=shape(data);if(s.kind==='value')return [data[0]?.[0]];if(s.kind!=='list')throw Error('표 범위는 한 줄 데이터처럼 직접 계산할 수 없습니다.');return s.rows===1?data[0].slice():data.map(r=>r[0]);}
  function fromList(values,orientation){return orientation==='row'?[values]:values.map(v=>[v]);}
  function compute(input,op,right){
    if(op==='none')return input.map(r=>r.slice());
    if(op==='sum'||op==='average'){const nums=input.flat().map(numeric);if(!nums.length)throw Error('계산할 값이 없습니다.');return [[finite(nums.reduce((a,b)=>a+b,0)/(op==='average'?nums.length:1))]];}
    const aShape=shape(input),bShape=shape(right),apply=(a,b)=>{a=numeric(a);b=numeric(b);if(op==='multiply')return finite(a*b);if(op==='divide'){if(b===0)throw Error('0으로 나눌 수 없습니다.');return finite(a/b);}if(op==='add')return finite(a+b);if(op==='subtract')return finite(a-b);throw Error('지원하지 않는 연산입니다.');};
    if(aShape.kind==='value'&&bShape.kind==='value')return [[apply(input[0][0],right[0][0])]];
    if(aShape.kind==='value'){return right.map(row=>row.map(v=>apply(input[0][0],v)));}
    if(bShape.kind==='value'){return input.map(row=>row.map(v=>apply(v,right[0][0])));}
    if(aShape.kind==='list'&&bShape.kind==='list'){
      const a=listValues(input),b=listValues(right);if(a.length!==b.length)throw Error('계산할 행·열 데이터의 개수가 다릅니다.');return fromList(a.map((v,i)=>apply(v,b[i])),aShape.rows===1?'row':'column');
    }
    if(aShape.rows!==bShape.rows||aShape.cols!==bShape.cols)throw Error('계산할 표 범위의 행·열 크기가 다릅니다.');
    return input.map((row,y)=>row.map((v,x)=>apply(v,right[y][x])));
  }
  function sourceData(tags,column){
    if(!tags.has(column.tag))throw Error('결과에 사용할 데이터를 찾을 수 없습니다: '+column.tag);
    const data=tags.get(column.tag),s=shape(data);
    if(s.kind==='table'){
      if(!String(column.tableColumn??'').trim())throw Error(column.tag+': 표 범위에서 결과에 사용할 열 번호를 지정하세요.');
      const n=integer(column.tableColumn,'Table 열 번호');if(n>s.cols)throw Error(column.tag+': 표 범위에 '+n+'번째 열이 없습니다.');return data.map(r=>[r[n-1]??null]);
    }
    return data;
  }
  function output(tags,rawConfig){
    const config=rawConfig||{kind:'table',columns:[]};if(!config.columns.length)throw Error('결과 항목을 추가하세요.');
    const entries=config.columns.map(c=>{
      if(config.kind==='table')return {c,data:sourceData(tags,c)};
      if(!tags.has(c.tag))throw Error('결과에 사용할 데이터를 찾을 수 없습니다: '+c.tag);
      return {c,data:tags.get(c.tag)};
    });
    if(config.kind==='table'){
      const seq=entries.map(e=>({e,shape:shape(e.data),values:listValues(e.data)}));
      const lengths=seq.filter(x=>x.shape.kind!=='value').map(x=>x.values.length),n=lengths.length?Math.max(...lengths):1;
      if(lengths.some(x=>x!==n))throw Error('결과에 넣을 행·열 데이터의 개수가 서로 다릅니다. Data Labeling에서 확인하세요.');
      if((n+1)*entries.length>LIMIT)throw Error('출력 미리보기는 10,000셀까지 지원합니다.');
      return [entries.map(e=>e.c.label),...Array.from({length:n},(_,i)=>seq.map(x=>x.shape.kind==='value'?x.values[0]:x.values[i]))];
    }
    const placed=new Set(),rows=[];
    for(const e of entries){const start=address(e.c.target),data=e.data;
      if((start.row+data.length-1)*(start.column+Math.max(1,...data.map(r=>r.length))-1)>LIMIT)throw Error('출력 미리보기는 10,000셀까지 지원합니다.');
      data.forEach((row,y)=>row.forEach((v,x)=>{const r=start.row+y-1,c=start.column+x-1,key=r+','+c;if(placed.has(key))throw Error('출력 영역이 겹칩니다: '+colName(c+1)+(r+1));placed.add(key);if(!rows[r])rows[r]=[];rows[r][c]=v;}));
    }
    const width=Math.max(0,...rows.filter(Boolean).map(r=>r.length));return Array.from({length:rows.length},(_,i)=>Array.from({length:width},(_,j)=>rows[i]?.[j]??null));
  }
  function validate(rawConfig){
    const config=normalize(rawConfig),errors=[];
    if(!config.name.trim())errors.push('프로세스 이름을 입력하세요.');
    if(!config.types.length)errors.push('파일 종류를 하나 이상 추가하세요.');
    const seenTypes=new Set();for(const t of config.types){if(!t.name.trim()||seenTypes.has(t.name))errors.push('파일 유형 이름은 비어 있거나 중복될 수 없습니다.');seenTypes.add(t.name);if(!t.conditions.length||t.conditions.some(c=>!String(c.value).trim()&&['contains','equals','starts','ends'].includes(c.operator)))errors.push(t.name+': 분류 조건을 입력하세요.');}
    const scopes=new Map();for(const t of config.types)scopes.set(t.id,new Set());
    for(const tag of config.tags){const set=scopes.get(tag.type);if(!set){errors.push('가져올 값에 적용할 파일 종류를 선택하세요.');continue;}if(!tag.name.trim()||set.has(tag.name))errors.push('같은 파일 종류 안에서 항목 이름은 비어 있거나 중복될 수 없습니다.');set.add(tag.name);if(tag.sheetMode==='name'&&!tag.sheet.trim())errors.push(tag.name+': 시트명을 입력하세요.');if(tag.sheetMode==='index'&&!String(tag.sheetIndex).trim())errors.push(tag.name+': 시트 번호를 입력하세요.');try{address(tag.start);}catch(e){errors.push(tag.name+': '+e.message);}}
    for(const tag of config.tags){for(const key of ['min','max'])if(tag[key]!==undefined&&tag[key]!==''&&!Number.isFinite(Number(tag[key])))errors.push(tag.name+': 검수 기준은 숫자로 입력하세요.');if(tag.min!==undefined&&tag.min!==''&&tag.max!==undefined&&tag.max!==''&&Number(tag.min)>Number(tag.max))errors.push(tag.name+': 최솟값은 최댓값 이하여야 합니다.');}
    for(const t of config.types){const results=new Set(config.tags.filter(x=>x.type===t.id).map(x=>x.name));for(const s of config.steps.filter(x=>!x.type||x.type==='*'||x.type===t.id)){if(!s.result.trim()||results.has(s.result))errors.push(t.name+': 계산값 이름은 기존 항목과 겹치지 않게 지정하세요.');results.add(s.result);}}
    for(const c of config.output.columns){if(!c.label.trim())errors.push('결과 열 이름을 입력하세요.');if(!c.tag.trim())errors.push((c.label||'결과 항목')+': 사용할 데이터를 선택하세요.');}
    return [...new Set(errors)];
  }
  function evaluate(book,rawConfig,options={}){
    const config=normalize(rawConfig);
    const automatic=classify(book,config),manual=config.types.find(t=>t.id===options.typeId);
    const classification=manual?{type:manual,status:'matched',reason:'사용자가 지정한 분류',automatic}:automatic;
    const tags=new Map(),errors=validate(config),values=options.values||Object.create(null);
    if(options.typeId&&!manual)return {classification:{type:null,status:'unmatched',reason:'사용자가 지정한 파일 유형이 Process에 없습니다.'},tags,rows:null,errors:['사용자가 지정한 파일 유형이 Process에 없습니다.']};
    if(!classification.type)return {classification,tags,rows:null,errors:[...errors,classification.reason]};
    if(errors.length)return {classification,tags,rows:null,errors};
    for(const tag of config.tags.filter(t=>t.type===classification.type.id)){try{
      const overridden=Object.prototype.hasOwnProperty.call(values,tag.name);
      const value=overridden?values[tag.name]:extract(book,tag);
      if(!Array.isArray(value)||!value.length||!value.every(r=>Array.isArray(r)&&r.length===value[0].length&&r.length))throw Error(tag.name+': 수정값의 행·열 형태를 확인하세요.');
      const normalized=value.map(row=>row.map(v=>{if(v&&typeof v==='object')throw Error(tag.name+': 지원하지 않는 수정값입니다.');if(tag.format==='number'&&v!==null&&v!=='')return numeric(v);return tag.format==='text'&&v!==null?String(v):v;}));
      tags.set(tag.name,normalized);
    }catch(e){errors.push(e.message);}}
    const pending=config.steps.filter(s=>!s.type||s.type==='*'||s.type===classification.type.id).slice();
    while(pending.length){let progress=false;
      for(let i=pending.length-1;i>=0;i--){const step=pending[i];if(!tags.has(step.input))continue;const needs=['multiply','divide','add','subtract'].includes(step.op);if(needs&&step.rightKind==='tag'&&!tags.has(step.right))continue;
        try{const right=needs?(step.rightKind==='tag'?tags.get(step.right):[[numeric(step.right)]]):[[0]];tags.set(step.result,compute(tags.get(step.input),step.op,right));}catch(e){errors.push(step.result+': '+e.message);}pending.splice(i,1);progress=true;
      }
      if(!progress){errors.push('계산에 필요한 데이터를 찾을 수 없거나 순환 참조가 있습니다: '+pending.map(s=>s.result).join(', '));break;}
    }
    let rows=null;if(!errors.length){try{rows=output(tags,config.output);}catch(e){errors.push(e.message);}}
    return {classification,tags,rows,errors};
  }
  global.ProcessCore=Object.freeze({fresh,normalize,colName,columnNumber,address,shape,extract,classify,compute,output,validate,evaluate});
})(typeof window!=='undefined'?window:globalThis);
