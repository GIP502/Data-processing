/* Process Builder UI. Keeps the rule engine explicit while presenting it as File → Data → Result. */
window.ProcessBuilder=(function(){
  'use strict';
  const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const uid=()=>globalThis.crypto?.randomUUID?.()||'id-'+Date.now()+'-'+Math.random().toString(16).slice(2);
  const clone=x=>JSON.parse(JSON.stringify(x));
  function create(){
    let config=ProcessCore.fresh(),books=[],selected=0,stage=0,typeId=config.types[0].id,saved=[],notice='',dirty=false,root=null,timer=null,reading=0;
    saved=ProcessStore.list();
    const stages=['파일 나누기','데이터 가져오기','결과 만들기'];
    const query=s=>root?.querySelector(s);
    function input(path,value,placeholder='',type='text',attrs=''){
      return `<input type="${type}" ${type==='number'?'min="1" step="1"':''} data-path="${path}" value="${esc(value)}" placeholder="${esc(placeholder)}" aria-label="${esc(placeholder||path)}" ${attrs}>`;
    }
    function select(path,value,items,attrs=''){return `<select data-path="${path}" aria-label="${esc(path)}" ${attrs}>${items.map(([v,l])=>`<option value="${esc(v)}" ${v===value?'selected':''}>${esc(l)}</option>`).join('')}</select>`;}
    const button=(action,label,index='',className='pb-button')=>`<button type="button" data-action="${action}" data-index="${index}" class="${className}">${label}</button>`;
    const field=(label,html,cls='')=>`<label class="pb-field ${cls}"><span>${label}</span>${html}</label>`;
    const hint=text=>`<p class="pb-hint">${text}</p>`;
    function savedOptions(){return '<option value="">저장된 프로세스 선택</option>'+saved.map(p=>`<option value="${esc(p.id)}" ${p.id===config.id?'selected':''}>${esc(p.name)}</option>`).join('');}
    function typeOptions(){return config.types.map(t=>[t.id,t.name]);}
    function opOptions(){return [['contains','포함'],['not-contains','포함하지 않음'],['equals','정확히 일치'],['not-equals','일치하지 않음'],['starts','~로 시작'],['ends','~로 끝남']];}
    function sheetRefFields(path,obj){
      const mode=field('시트 찾는 방법',select(path+'.sheetMode',obj.sheetMode||'name',[['name','시트 이름으로'],['index','시트 순서로']]));
      const ref=obj.sheetMode==='index'?field('시트 번호',input(path+'.sheetIndex',obj.sheetIndex||'1','예: 1','number')):field('시트 이름',input(path+'.sheet',obj.sheet||'Sheet1','예: Sheet1'));
      return mode+ref;
    }
    function dynamicRowFields(path,t){
      const mode=t.endRowMode||'fixed';
      let html=field('어디까지 가져올까요?',select(path+'.endRowMode',mode,[['fixed','직접 지정'],['last-data','마지막 데이터까지'],['until-blank','빈 셀이 나오기 전까지'],...(mode==='sheet-end'?[['sheet-end','시트의 끝까지 (기존 설정)']]:[])]));
      html+=mode==='sheet-end'?hint('기존 설정의 시트 마지막 행까지 가져옵니다.'):mode==='fixed'?field('끝 행',input(path+'.endRow',t.endRow,'예: 200','number')):field('마지막 행을 판단할 열',input(path+'.endRowBy',t.endRowBy||'A','예: B'));
      return html;
    }
    function dynamicColumnFields(path,t){
      const mode=t.endColumnMode||'fixed';
      let html=field('어디까지 가져올까요?',select(path+'.endColumnMode',mode,[['fixed','직접 지정'],['last-data','마지막 데이터까지'],['until-blank','빈 셀이 나오기 전까지'],...(mode==='sheet-end'?[['sheet-end','시트의 끝까지 (기존 설정)']]:[])]));
      html+=mode==='sheet-end'?hint('기존 설정의 시트 마지막 열까지 가져옵니다.'):mode==='fixed'?field('끝 열',input(path+'.endColumn',t.endColumn,'예: 8','number')):field('마지막 열을 판단할 행',input(path+'.endColumnBy',t.endColumnBy||'1','예: 5','number'));
      return html;
    }
    function kindLabel(kind){return {cell:'한 셀',row:'가로 한 줄',column:'세로 한 줄',range:'표 범위'}[kind]||'데이터';}
    function shapeLabel(data){const s=ProcessCore.shape(data);return s.kind==='value'?'한 셀 · 1개':s.kind==='list'?`한 줄 · ${s.length}개`:`표 · ${s.rows}행 × ${s.cols}열`;}
    function editor(){
      if(!root)return;
      query('[data-slot="tabs"]').innerHTML=stages.map((s,i)=>`<button type="button" role="tab" aria-selected="${stage===i}" data-action="stage" data-index="${i}" class="pb-tab ${stage===i?'active':''}"><span>${i+1}</span>${s}</button>`).join('');
      let html='';
      if(stage===0){
        html=`<div class="pb-section-head"><div><h2>1. 파일을 나누는 기준을 정하세요</h2>${hint('예: 파일명에 “main”이 들어가면 Main으로 분류합니다. 어떤 규칙에도 맞지 않거나 여러 종류에 동시에 맞으면 Data Labeling에서 확인합니다.')}</div>${button('add-type','＋ 파일 종류')}</div>`;
        config.types.forEach((t,i)=>{
          html+=`<section class="pb-card pb-type-card"><div class="pb-card-head">${field('파일 종류 이름',input(`types.${i}.name`,t.name,'예: Main'))}${field('조건이 여러 개라면',select(`types.${i}.mode`,t.mode,[['all','모두 맞아야 함'],['any','하나만 맞아도 됨']]))}${button('remove-type','삭제',i)}</div>`;
          t.conditions.forEach((c,j)=>{
            const p=`types.${i}.conditions.${j}`;
            html+=`<div class="pb-rule"><div class="pb-rule-line"><span class="pb-rule-word">만약</span>${field('어디를 볼까요?',select(p+'.kind',c.kind,[['filename','파일명 전체'],['filename-token','파일명을 나눈 값'],['cell','특정 셀'],['sheet','시트 이름']] ))}${field('어떻게 비교할까요?',select(p+'.operator',c.operator,opOptions()))}${field('찾을 값',input(p+'.value',c.value,'예: main'))}<button class="pb-remove" data-action="remove-condition" data-index="${i},${j}" aria-label="조건 삭제">×</button></div>`;
            if(c.kind==='filename-token')html+=`<div class="pb-subrow">${field('나눌 문자',input(p+'.delimiter',c.delimiter||'_','예: _'))}${field('몇 번째 조각',input(p+'.part',c.part||'1','예: 2','number'))}<span class="pb-example">예: 2_main_there → “_”로 나눈 두 번째 값은 main</span></div>`;
            if(c.kind==='cell')html+=`<div class="pb-subrow">${sheetRefFields(p,c)}${field('셀 위치',input(p+'.address',c.address||'A1','예: B3'))}</div>`;
            html+='</div>';
          });
          html+=`<div class="pb-card-actions">${button('add-condition','＋ 조건 추가',i)}</div></section>`;
        });
      }else if(stage===1){
        if(!config.types.some(t=>t.id===typeId))typeId=config.types[0]?.id||'';
        const names=[...new Set([...config.tags.map(t=>t.name),...config.steps.map(s=>s.result)].filter(Boolean))];
        html=`<div class="pb-section-head"><div><h2>2. 필요한 데이터를 가져오세요</h2>${hint('한 셀, 한 줄, 표 범위를 가져올 수 있습니다. 파일마다 데이터 길이가 달라도 마지막 데이터나 첫 빈 셀을 기준으로 자동으로 범위를 맞출 수 있습니다.')}</div></div>
          <label class="pb-field pb-type-select"><span>어떤 파일 종류에 적용할까요?</span><select data-action="type-select">${typeOptions().map(([id,name])=>`<option value="${id}" ${id===typeId?'selected':''}>${esc(name)}</option>`).join('')}</select></label>
          <div class="pb-group-head"><div><strong>가져올 값</strong><span>Excel에서 읽을 항목</span></div>${button('add-data','＋ 값 가져오기')}</div>`;
        config.tags.forEach((t,i)=>{if(t.type!==typeId)return;const p=`tags.${i}`;
          html+=`<section class="pb-card"><div class="pb-card-head">${field('항목 이름',input(p+'.name',t.name,'예: 매출액'))}${field('가져올 모양',select(p+'.kind',t.kind,[['cell','한 셀'],['column','세로로 이어진 값'],['row','가로로 이어진 값'],['range','표 범위']]))}<span class="pb-type-chip">${kindLabel(t.kind)}</span>${button('remove-data','삭제',i)}</div>
            <div class="pb-form-row">${sheetRefFields(p,t)}${field('시작 위치',input(p+'.start',t.start||'A1','예: C5'))}${field('읽는 방식',select(p+'.format',t.format,[['auto','자동 인식'],['number','숫자로 읽기'],['text','문자로 읽기']]))}</div>`;
          if(t.kind==='column')html+=`<div class="pb-form-row pb-dynamic-row">${dynamicRowFields(p,t)}</div>`;
          if(t.kind==='row')html+=`<div class="pb-form-row pb-dynamic-row">${dynamicColumnFields(p,t)}</div>`;
          if(t.kind==='range')html+=`<div class="pb-dynamic-grid"><div><strong>아래쪽 범위</strong><div class="pb-form-row">${dynamicRowFields(p,t)}</div></div><div><strong>오른쪽 범위</strong><div class="pb-form-row">${dynamicColumnFields(p,t)}</div></div></div>`;
          html+=`<details class="pb-checks"><summary>검수 기준 (선택)</summary><div class="pb-form-row">${field('최솟값',input(p+'.min',t.min??'','제한 없음'))}${field('최댓값',input(p+'.max',t.max??'','제한 없음'))}${field('확인 방식',select(p+'.review',t.review||'normal',[['normal','문제 있을 때만'],['always','항상 사용자 확인']]))}</div></details><div class="pb-card-note">${t.kind==='cell'?'한 셀 값은 결과가 여러 행이어도 각 행에 반복해서 넣을 수 있습니다.':t.kind==='range'?'표 범위를 결과에 넣을 때는 결과 만들기에서 사용할 열을 고릅니다.':'가져온 값의 개수만큼 결과 행을 만들 수 있습니다.'}</div></section>`;
        });
        if(!config.tags.some(t=>t.type===typeId))html+=`<div class="pb-empty-card">이 파일 종류에서 가져올 값을 추가하세요.</div>`;
        html+=`<div class="pb-divider"></div><div class="pb-group-head"><div><strong>계산값 만들기</strong><span>가져온 값을 이용해 새 값 만들기</span></div>${button('add-calc','＋ 계산값 만들기')}</div><datalist id="pb-data-list">${names.map(n=>`<option value="${esc(n)}">`).join('')}</datalist>`;
        const visible=config.steps.map((s,i)=>({s,i})).filter(x=>x.s.type===typeId||x.s.type==='*');
        visible.forEach(({s,i})=>{const p=`steps.${i}`,binary=['multiply','divide','add','subtract'].includes(s.op);const opSymbol={multiply:'×',divide:'÷',add:'+',subtract:'−',sum:'SUM',average:'AVERAGE',none:'='}[s.op]||'?';
          html+=`<section class="pb-card pb-calc-card"><div class="pb-card-head">${field('계산값 이름',input(p+'.result',s.result,'예: 평균단가'))}${field('어디에 적용할까요?',select(p+'.type',s.type||typeId,[...typeOptions(),['*','모든 파일 종류']]))}${button('remove-calc','삭제',i)}</div>
          <div class="pb-form-row">${field('첫 번째 값',input(p+'.input',s.input,'예: 매출액','text','list="pb-data-list"'))}${field('계산',select(p+'.op',s.op,[['multiply','곱하기 ×'],['divide','나누기 ÷'],['add','더하기 +'],['subtract','빼기 −'],['sum','합계 SUM'],['average','평균 AVERAGE'],['none','그대로 복사']]))}`;
          if(binary)html+=field('두 번째 값 방식',select(p+'.rightKind',s.rightKind,[['number','직접 숫자 입력'],['tag','가져온 값 사용']]))+field(s.rightKind==='tag'?'두 번째 값':'숫자',input(p+'.right',s.right,s.rightKind==='tag'?'예: 수량':'예: 100','text',s.rightKind==='tag'?'list="pb-data-list"':''));
          html+=`</div><div class="pb-formula-preview"><span>계산식</span><code>${esc(s.result||'결과')} = ${s.op==='sum'||s.op==='average'?opSymbol+'('+esc(s.input||'데이터')+')':esc(s.input||'데이터')+' '+opSymbol+' '+(binary?esc(s.right||'값'):'')}</code></div></section>`;
        });
        if(!visible.length)html+=`<div class="pb-empty-card">계산이 필요 없으면 이 단계는 비워 두면 됩니다.</div>`;
      }else{
        const names=[...new Set([...config.tags.map(t=>t.name),...config.steps.map(s=>s.result)].filter(Boolean))];
        html=`<div class="pb-section-head"><div><h2>3. 결과에 들어갈 열을 정하세요</h2>${hint('파일 하나에서 결과가 여러 행 나와도 됩니다. 한 셀 값은 필요한 행마다 반복되고, 행·열 데이터는 순서대로 결과 행에 들어갑니다. 서로 개수가 맞지 않으면 Data Labeling에서 오류로 표시합니다.')}</div>${button('add-output','＋ 결과 열')}</div>
          <label class="pb-field pb-policy"><span>검토 후 처리 방식</span>${select('processingPolicy',config.processingPolicy||'prompt',[['prompt','문제가 있으면 처리 전에 안내'],['block','모든 파일 확인이 끝나야 처리'],['normalOnly','정상 파일만 처리']])}</label><datalist id="pb-result-data-list">${names.map(n=>`<option value="${esc(n)}">`).join('')}</datalist>
          <details class="pb-advanced" ${config.output.kind==='position'?'open':''}><summary>고급 설정</summary>${field('결과 배치 방식',select('output.kind',config.output.kind,[['table','행으로 정리 (추천)'],['position','원본 모양대로 셀에 배치']]),'pb-output-kind')}</details>`;
        config.output.columns.forEach((c,i)=>{const p=`output.columns.${i}`;
          html+=`<section class="pb-card pb-output-card"><div class="pb-form-row">${field(config.output.kind==='table'?'결과 열 이름':'항목 이름',input(p+'.label',c.label,'예: 고객명'))}${field('넣을 데이터',input(p+'.tag',c.tag,'예: 고객명','text','list="pb-result-data-list"'))}`;
          if(config.output.kind==='table')html+=field('표 범위에서 사용할 열',input(p+'.tableColumn',c.tableColumn,'필요할 때만: 2','number'));
          if(config.output.kind==='position')html+=field('시작 셀',input(p+'.target',c.target,'예: A1'));
          html+=`${button('remove-output','삭제',i)}</div><div class="pb-order"><span>${config.output.kind==='table'?'한 셀 값은 반복 · 행/열 데이터는 순서대로':'가져온 모양 그대로 배치'}</span>${button('up-output','↑',i)}${button('down-output','↓',i)}</div></section>`;
        });
        if(!config.output.columns.length)html+=`<div class="pb-empty-card">최종 결과에 넣을 열을 추가하세요.</div>`;
        html+=config.output.kind==='table'?`<div class="pb-rule-summary"><strong>결과 행은 이렇게 만들어집니다</strong><p>• 한 셀 값만 있으면 결과 1행을 만듭니다.</p><p>• 한 셀 값과 행·열 데이터를 함께 쓰면 한 셀 값은 모든 결과 행에 반복됩니다.</p><p>• 여러 행·열 데이터를 함께 쓰면 데이터 개수가 같아야 합니다.</p><p>• 표 범위는 결과에 사용할 열 번호를 선택합니다.</p><p>• 개수가 맞지 않거나 없는 데이터는 자동으로 추측하지 않고 오류로 표시합니다.</p></div>`:`<div class="pb-rule-summary"><strong>원본 모양대로 배치</strong><p>가져온 데이터를 지정한 셀부터 그대로 배치합니다. 서로 겹치면 오류로 표시합니다.</p></div>`;
      }
      query('[data-slot="editor"]').innerHTML=html;preview();
    }
    function status(){const s=query('[data-slot="status"]');if(s)s.textContent=notice||[dirty?'저장되지 않은 변경사항':'설정 준비',reading?'예시 파일 읽는 중…':''].filter(Boolean).join(' · ');}
    function table(rows){if(!rows?.length)return '<div class="pb-empty">출력할 값이 없습니다.</div>';const cols=Math.min(12,Math.max(...rows.map(r=>r.length)));
      return `<div class="pb-table-scroll"><table><thead><tr><th></th>${Array.from({length:cols},(_,i)=>`<th>${ProcessCore.colName(i+1)}</th>`).join('')}</tr></thead><tbody>${rows.slice(0,30).map((r,i)=>`<tr><th>${i+1}</th>${Array.from({length:cols},(_,j)=>`<td>${esc(r[j])}</td>`).join('')}</tr>`).join('')}</tbody></table></div><p class="pb-hint">${rows.length}행 · 최대 30행 / 12열 표시</p>`;
    }
    function preview(){
      if(!root)return;clearTimeout(timer);const list=query('[data-slot="files"]');
      list.innerHTML=books.map((b,i)=>{const c=ProcessCore.classify(b,config);return `<div class="pb-file ${i===selected?'selected':''}"><button data-action="select-file" data-index="${i}"><strong>${esc(b.name)}</strong><span class="pb-badge ${c.status}">${esc(c.type?.name||({conflict:'분류 충돌',unmatched:'미분류'}[c.status]))}</span></button><button class="pb-remove" data-action="remove-file" data-index="${i}" aria-label="예시 파일 제거">×</button></div>`;}).join('');
      const target=query('[data-slot="preview"]');
      if(!books.length){target.innerHTML='<div class="pb-preview-empty"><img src="assets/branding/process-builder.png" alt=""><strong>예시 파일로 바로 확인하세요</strong><p>Excel 파일을 넣으면<br>파일 분류 · 가져온 값 · 결과를 바로 확인합니다.</p></div>';status();return;}
      selected=Math.max(0,Math.min(selected,books.length-1));const result=ProcessCore.evaluate(books[selected],config);
      const values=[...result.tags].map(([name,value])=>`<div><div class="pb-value-head"><strong>${esc(name)}</strong><span>${esc(shapeLabel(value))}</span></div><pre>${esc(JSON.stringify(value.slice(0,6)))}</pre></div>`).join('');
      target.innerHTML=`<section class="pb-preview-section"><h3>파일 분류 결과</h3><strong>${esc(result.classification.type?.name||'확인 필요')}</strong><p class="pb-hint">${esc(result.classification.reason)}</p></section><section class="pb-preview-section"><h3>결과 미리보기</h3>${result.errors.length?'<div class="pb-errors">'+result.errors.map(e=>`<p>${esc(e)}</p>`).join('')+'</div>':table(result.rows)}</section><details class="pb-tag-values" ${stage===1?'open':''}><summary>가져온 데이터 (${result.tags.size})</summary>${values||'<p class="pb-hint">추출된 데이터가 없습니다.</p>'}</details>`;status();
    }
    function schedule(){clearTimeout(timer);timer=setTimeout(preview,120);status();}
    async function readFiles(files){if(books.length>=20){notice='예시 파일은 최대 20개까지 넣을 수 있습니다.';status();return;}for(const file of Array.from(files).slice(0,20-books.length)){reading++;notice='';status();try{const book=await ProcessFiles.read(file);books.push(book);selected=books.length-1;}catch(e){notice=file.name+': '+e.message;}finally{reading--;preview();}}}
    function refresh(){if(!root)return;config=ProcessCore.normalize(config);query('[data-role="name"]').value=config.name;query('[data-role="saved"]').innerHTML=savedOptions();editor();}
    function changed(){dirty=true;notice='';schedule();}
    function mount(content){
      saved=ProcessStore.list();
      const unsubscribe=ProcessStore.subscribe(()=>{saved=ProcessStore.list();if(root)query('[data-role="saved"]').innerHTML=savedOptions();});
      root=content;root.classList.add('frame-content','process-content');
      root.innerHTML=`<div class="pb-shell"><div class="pb-management"><label class="pb-field"><span>프로세스 이름</span><input data-role="name" value="${esc(config.name)}"></label><div class="pb-process-picker"><select data-role="saved" aria-label="저장된 프로세스">${savedOptions()}</select>${button('load','불러오기')}</div>${button('new','새로 만들기')}${button('save','저장')}</div><div class="pb-columns"><section class="pb-settings" aria-label="프로세스 설정"><div data-slot="tabs" class="pb-tabs" role="tablist" aria-label="설정 단계"></div><div data-slot="editor" class="pb-editor" role="tabpanel"></div></section><aside class="pb-preview" aria-label="실시간 미리보기"><div class="pb-preview-title"><h2>실시간 미리보기</h2><span>PREVIEW</span></div><div class="pb-upload" tabindex="0" role="button" aria-label="예시 Excel 파일 선택"><img src="assets/icons/11-open-file.svg" alt=""><strong>예시 Excel 파일 넣기</strong><span>끌어다 놓거나 클릭하세요</span><small>.xlsx · .xls · .xlsm / 여러 파일</small><input type="file" accept=".xlsx,.xls,.xlsm" multiple hidden data-role="files"></div><div class="pb-sample-actions">${button('demo','예시 데이터 보기')}${button('clear-files','비우기')}</div><div data-slot="files" class="pb-files"></div><div data-slot="preview" class="pb-live" aria-live="polite"></div></aside></div><footer class="pb-footer"><span data-slot="status"></span><span>규칙 밖 데이터는 Data Labeling에서 오류로 표시합니다.</span></footer></div>`;
      const controller=new AbortController(),opts={signal:controller.signal};
      root.addEventListener('input',event=>{const el=event.target;if(el.dataset.role==='name'){config.name=el.value;changed();return;}if(!el.dataset.path)return;const keys=el.dataset.path.split('.');let target=config;for(const key of keys.slice(0,-1))target=target[key];target[keys.at(-1)]=el.value;changed();if(el.tagName==='SELECT')editor();},opts);
      root.addEventListener('change',event=>{if(event.target.dataset.role==='files'){readFiles(event.target.files);event.target.value='';}if(event.target.dataset.action==='type-select'){typeId=event.target.value;editor();}},opts);
      root.addEventListener('click',event=>{
        const upload=event.target.closest('.pb-upload');if(upload&&event.target.type!=='file'){query('[data-role="files"]').click();return;}
        const el=event.target.closest('[data-action]');if(!el||el.tagName==='SELECT')return;const action=el.dataset.action,i=Number(el.dataset.index);
        if(action==='stage'){stage=i;editor();return;}if(action==='select-file'){selected=i;preview();return;}if(action==='remove-file'){books.splice(i,1);preview();return;}if(action==='clear-files'){books=[];selected=0;preview();return;}
        if(action==='demo'){if(books.length>=20){notice='예시 파일은 최대 20개까지 넣을 수 있습니다.';status();return;}books.push({name:'2_main_there.xlsx',sheets:[{name:'Sheet1',rows:[['항목','값','수량'],['A',10,2],['B',20,4],['C',30,5]]}]});selected=books.length-1;preview();return;}
        if(action==='save'){if(!config.name.trim()){notice='Process 이름을 입력하세요.';status();return;}const copy=ProcessCore.normalize(config);if(!copy.id)copy.id=uid();try{config=ProcessStore.save(copy);saved=ProcessStore.list();dirty=false;notice=ProcessCore.validate(config).length?'초안으로 저장했습니다. 미리보기 오류를 확인하세요.':'저장했습니다.';refresh();}catch(_){notice='브라우저 저장소에 저장하지 못했습니다.';status();}return;}
        if(action==='load'){const savedId=query('[data-role="saved"]').value,p=saved.find(x=>x.id===savedId);if(!p){notice='불러올 Process를 선택하세요.';status();return;}config=ProcessCore.normalize(p);typeId=config.types[0]?.id||'';dirty=false;notice='불러왔습니다.';refresh();return;}
        if(action==='new'){config=ProcessCore.fresh();typeId=config.types[0].id;stage=0;dirty=false;notice='새 Process를 만들었습니다.';refresh();return;}
        if(action==='add-type'){const id=uid();config.types.push({id,name:'유형 '+(config.types.length+1),mode:'all',conditions:[{kind:'filename',operator:'contains',value:'',delimiter:'_',part:'1',sheetMode:'name',sheet:'Sheet1',sheetIndex:'1',address:'A1'}]});}
        if(action==='remove-type'){const id=config.types[i].id;config.types.splice(i,1);config.tags=config.tags.filter(t=>t.type!==id);config.steps=config.steps.filter(s=>s.type!==id);if(typeId===id)typeId=config.types[0]?.id||'';}
        if(action==='add-condition')config.types[i].conditions.push({kind:'filename',operator:'contains',value:'',delimiter:'_',part:'1',sheetMode:'name',sheet:'Sheet1',sheetIndex:'1',address:'A1'});
        if(action==='remove-condition'){const [a,b]=el.dataset.index.split(',').map(Number);config.types[a].conditions.splice(b,1);}
        if(action==='add-data'){if(!typeId){notice='파일 유형을 먼저 추가하세요.';status();return;}config.tags.push({id:uid(),type:typeId,name:'',sheetMode:'name',sheet:'Sheet1',sheetIndex:'1',kind:'cell',start:'A1',row:'1',column:'1',endRow:'',endColumn:'',endRowMode:'last-data',endRowBy:'A',endColumnMode:'last-data',endColumnBy:'1',format:'auto'});}
        if(action==='remove-data')config.tags.splice(i,1);
        if(action==='add-calc')config.steps.push({id:uid(),type:typeId||'*',input:config.tags.find(t=>t.type===typeId)?.name||'',op:'divide',rightKind:'number',right:'1',result:''});
        if(action==='remove-calc')config.steps.splice(i,1);
        if(action==='add-output')config.output.columns.push({id:uid(),label:'',tag:'',tableColumn:'',target:'A1'});
        if(action==='remove-output')config.output.columns.splice(i,1);
        if(action==='up-output'&&i>0)[config.output.columns[i-1],config.output.columns[i]]=[config.output.columns[i],config.output.columns[i-1]];
        if(action==='down-output'&&i<config.output.columns.length-1)[config.output.columns[i+1],config.output.columns[i]]=[config.output.columns[i],config.output.columns[i+1]];
        changed();editor();
      },opts);
      root.addEventListener('keydown',e=>{if(e.target.classList.contains('pb-upload')&&['Enter',' '].includes(e.key)){e.preventDefault();query('[data-role="files"]').click();}},opts);
      root.addEventListener('dragover',e=>{if(e.dataTransfer.types.includes('Files')){e.preventDefault();query('.pb-upload').classList.add('drag-over');}},opts);
      root.addEventListener('dragleave',e=>{if(!root?.contains(e.relatedTarget))query('.pb-upload')?.classList.remove('drag-over');},opts);
      root.addEventListener('drop',e=>{e.preventDefault();query('.pb-upload').classList.remove('drag-over');readFiles(e.dataTransfer.files);},opts);
      editor();return ()=>{controller.abort();unsubscribe();clearTimeout(timer);root=null;};
    }
    return Object.freeze({mount});
  }
  return Object.freeze({create});
})();
