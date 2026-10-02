/* Review controller/UI. State is local to this window; Result receives an immutable run snapshot. */
window.DataLabeling=(()=>{
  'use strict';
  const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const copy=x=>JSON.parse(JSON.stringify(x));
  const id=()=>crypto.randomUUID();
  const symbol={normal:'✓',review:'!',unmatched:'?',error:'×',reading:'…',waiting:'—'};
  function create({onProcessed}){
    let entries=[],process=null,processId='',selectedId='',filter='all',search='',selected=new Set(),root=null,showDetail=true,notice='',confirmation=false,renderTimer=null,processing=false,updated=false;
    const find=key=>entries.find(e=>e.id===key),active=()=>find(selectedId);
    function loadInitial(){const list=ProcessStore.list();if(!process){const p=list.find(x=>x.id===ProcessStore.defaultId())||list[0];if(p){process=copy(p);processId=p.id;}}}
    function analyze(entry){entry.result=LabelingCore.analyze(entry,process);}
    function reanalyzeAll({reset=false}={}){for(const e of entries){if(reset){e.typeId='';e.overrides=Object.create(null);e.editErrors=Object.create(null);e.drafts=Object.create(null);}e.acknowledged=false;analyze(e);}confirmation=false;}
    function statusBadge(e){return `<span class="dl-status ${e.result.status}"><i>${symbol[e.result.status]}</i>${LabelingCore.STATUS[e.result.status]}${e.acknowledged?' · 확인됨':''}</span>`;}
    function definition(entry,name){return process?.tags.find(t=>t.type===entry.result.classification?.type?.id&&t.name===name);}
    const matrix=v=>v&&!(v.length===1&&v[0].length===1);
    function format(v){if(v===null||v===undefined)return '';return String(v);}
    function valueCell(e,name){
      const tag=definition(e,name),data=e.result.tags.get(name),edited=Object.prototype.hasOwnProperty.call(e.overrides,name);
      if(tag&&(!data||!matrix(data))&&tag.kind==='cell')return `<td class="dl-value ${edited?'edited':''}"><input class="${e.editErrors?.[name]?'invalid':''}" data-edit="${esc(name)}" data-entry="${e.id}" value="${esc(e.editErrors?.[name]?e.drafts[name]:data?.[0]?.[0])}" aria-label="${esc(e.name+' '+name)}" ${e.included===false?'disabled':''}>${edited?'<span class="dl-pencil" title="사용자 수정">✎</span>':''}</td>`;
      if(data){const summary=matrix(data)?`${data.length}행 × ${data[0].length}열`:format(data[0][0]);return `<td class="dl-value ${edited?'edited':''}"><button class="dl-cell-button" data-action="inspect-tag" data-entry="${e.id}" data-tag="${esc(name)}" title="${esc(name+' 값 상세')}">${esc(summary||'빈값')}${edited?' ✎':''}</button>${!tag?'<small class="dl-calculated">계산</small>':''}</td>`;}
      return `<td class="dl-value"><span class="dl-dash">—</span>${tag?`<button class="dl-fix" data-action="inspect-tag" data-entry="${e.id}" data-tag="${esc(name)}">수정</button>`:''}</td>`;
    }
    function detail(){
      const e=active();if(!e)return '<div class="dl-detail-empty"><img src="assets/branding/data-labeling.png" alt=""><strong>파일을 선택하세요</strong><p>분류·원본 위치·오류 원인을<br>여기에서 확인할 수 있습니다.</p></div>';
      const type=e.result.classification?.type;
      let html=`<div class="dl-detail-heading"><span>FILE DETAIL</span><button data-action="toggle-detail" title="상세 패널 접기" aria-label="상세 패널 접기">×</button></div><h2>${esc(e.name)}</h2>${statusBadge(e)}<p class="dl-detail-meta">${(e.size/1024).toFixed(1)} KB · ${e.book?.sheets.length||0}개 시트</p><label class="dl-include"><input type="checkbox" data-include="${e.id}" ${e.included?'checked':''}>이 파일을 처리에 포함</label><div class="dl-detail-actions"><button data-action="rerun-one" data-entry="${e.id}">다시 분석</button><button data-action="reset-one" data-entry="${e.id}">자동값 복원</button></div>`;
      html+=`<section class="dl-detail-section"><h3>분류${e.typeId?' <span class="dl-edited-label">사용자 지정</span>':''}</h3><select data-type="${e.id}" aria-label="${esc(e.name+' 분류')}"><option value="">자동 분류 사용</option>${process?.types.map(t=>`<option value="${esc(t.id)}" ${t.id===e.typeId?'selected':''}>${esc(t.name)}</option>`).join('')||''}</select><p>${esc(e.result.classification?.reason||e.readError||'파일을 분석하고 있습니다.')}</p>${type?`<strong>${esc(type.name)}</strong>`:''}</section>`;
      if(e.result.errors.length||e.result.warnings.length){html+='<section class="dl-detail-section"><h3>확인할 내용</h3>'+e.result.errors.map(s=>`<p class="dl-error-note">${esc(s)}</p>`).join('')+e.result.warnings.map(s=>`<p class="dl-warning-note">${esc(s)}</p>`).join('');
        if(e.result.status==='review'&&e.result.rows)html+=`<label class="dl-ack"><input type="checkbox" data-ack="${e.id}" ${e.acknowledged?'checked':''}>내용을 확인했습니다</label>`;html+='</section>';
      }
      if(type){
        html+='<section class="dl-detail-section"><h3>추출 데이터</h3>';
        for(const tag of process.tags.filter(t=>t.type===type.id)){
          const data=e.result.tags.get(tag.name);
          const sheetName=tag.sheetMode==='index'?(e.book?.sheets[Number(tag.sheetIndex)-1]?.name||tag.sheetIndex+'번째 시트'):tag.sheet;
          const start=tag.start||ProcessCore.colName(Number(tag.column)||1)+tag.row;
          const ends=[];
          if(['column','range'].includes(tag.kind))ends.push(tag.endRowMode==='last-data'?'마지막 데이터 행 (기준 열 '+tag.endRowBy+')':tag.endRowMode==='until-blank'?'첫 빈 셀 전 행 (기준 열 '+tag.endRowBy+')':tag.endRowMode==='sheet-end'?'시트 마지막 행':'끝 행 '+tag.endRow);
          if(['row','range'].includes(tag.kind))ends.push(tag.endColumnMode==='last-data'?'마지막 데이터 열 (기준 행 '+tag.endColumnBy+')':tag.endColumnMode==='until-blank'?'첫 빈 셀 전 열 (기준 행 '+tag.endColumnBy+')':tag.endColumnMode==='sheet-end'?'시트 마지막 열':'끝 열 '+tag.endColumn);
          const source=sheetName+'!'+start+(ends.length?' → '+ends.join(' · '):'');
          const edited=Object.prototype.hasOwnProperty.call(e.overrides,tag.name);
          html+=`<details class="dl-tag-detail" data-tag-detail="${esc(tag.name)}"><summary>${esc(tag.name)}${edited?' <span class="dl-edited-label">수정됨</span>':''}<span>${data?data.length+' × '+data[0].length:'읽기 실패'}</span></summary><p class="dl-source">원본: ${esc(source)}</p><textarea data-grid="${esc(tag.name)}" data-entry="${e.id}" aria-label="${esc(tag.name+' 수정값')}" spellcheck="false">${esc(e.editErrors?.[tag.name]?e.drafts[tag.name]:data?data.map(row=>row.map(format).join('\t')).join('\n'):'')}</textarea><p class="dl-grid-hint">열은 Tab, 행은 줄바꿈으로 구분합니다.</p><div class="dl-grid-actions"><button data-action="apply-grid" data-entry="${e.id}" data-tag="${esc(tag.name)}">수정 적용</button>${edited||e.editErrors?.[tag.name]?`<button data-action="reset-tag" data-entry="${e.id}" data-tag="${esc(tag.name)}">원본 복원</button>`:''}</div></details>`;
        }html+='</section>';
        const computed=process.steps.filter(s=>!s.type||s.type==='*'||s.type===type.id);
        if(computed.length)html+='<section class="dl-detail-section"><h3>계산 결과</h3>'+computed.map(s=>`<div class="dl-computed"><strong>${esc(s.result)}</strong><span>${esc(e.result.tags.get(s.result)?.flat().slice(0,8).join(' · ')||'—')}</span></div>`).join('')+'</section>';
      }
      return html;
    }
    function render(){
      if(!root)return;clearTimeout(renderTimer);renderTimer=null;
      const list=ProcessStore.list(),names=LabelingCore.columns(process),gate=LabelingCore.gate(entries);
      const visible=entries.filter(e=>(filter==='all'||e.result.status===filter)&&e.name.toLowerCase().includes(search.toLowerCase()));
      const counts=Object.fromEntries(['normal','review','unmatched','error'].map(s=>[s,entries.filter(e=>e.result.status===s).length]));
      const unread=entries.filter(e=>!e.book&&!e.readError).length;
      const issues=gate.blocked.length+gate.warnings.length;
      root.innerHTML=`<div class="dl-shell"><header class="dl-topbar"><div class="dl-process-select"><span>PROCESS</span><select data-role="process" aria-label="사용할 Process"><option value="">Process를 선택하세요</option>${list.map(p=>`<option value="${esc(p.id)}" ${p.id===processId?'selected':''}>${esc(p.name)}</option>`).join('')}</select><button data-action="default" class="dl-default ${ProcessStore.defaultId()===processId&&processId?'active':''}" title="기본 Process로 지정" ${!processId?'disabled':''}>☆</button></div><button data-action="add-files" class="dl-button dl-primary">＋ 파일 추가</button><input data-role="files" type="file" accept=".xlsx,.xls,.xlsm" multiple hidden></header>${!process?'<div class="dl-banner">Process 설정 창에서 저장한 Process를 선택하세요. 파일을 먼저 넣어도 됩니다.</div>':''}${updated?'<div class="dl-banner">선택한 Process가 변경되었습니다. 다시 분석을 누르면 새 규칙을 적용합니다.</div>':''}<div class="dl-filterbar"><div class="dl-filters">${[['all','전체',entries.length],['normal','정상',counts.normal],['review','확인 필요',counts.review],['unmatched','미분류',counts.unmatched],['error','오류',counts.error]].map(([s,n,c])=>`<button data-action="filter" data-filter="${s}" class="${filter===s?'active':''} ${s}">${s==='all'?'':symbol[s]+' '}${n}<span>${c}</span></button>`).join('')}</div><div class="dl-filter-tools"><input data-role="search" type="search" placeholder="파일명 검색" value="${esc(search)}" aria-label="파일명 검색"><button data-action="toggle-detail" class="dl-button" title="파일 상세 패널">상세 ${showDetail?'접기':'보기'}</button></div></div><div class="dl-file-tools"><span>${selected.size?selected.size+'개 선택':unread?unread+'개 분석 중':'파일별 결과를 확인하세요'}</span><div><button data-action="delete-selected" ${!selected.size?'disabled':''}>선택 삭제</button><button data-action="exclude-selected" ${!selected.size?'disabled':''}>선택 제외</button><button data-action="reanalyze" ${!entries.length||!process?'disabled':''}>다시 분석</button><button data-action="clear" ${!entries.length?'disabled':''}>전체 비우기</button></div></div><div class="dl-workspace ${showDetail?'':'detail-hidden'}"><section class="dl-main">${!entries.length?`<div class="dl-dropzone" role="button" tabindex="0" data-action="add-files" aria-label="Excel 파일 선택"><img src="assets/branding/data-labeling.png" alt=""><h2>Excel 파일을 여기에 끌어다 놓으세요</h2><p>파일을 넣으면 분류와 데이터 추출이 자동으로 시작됩니다.</p><span class="dl-button dl-primary">파일 선택</span><small>.xlsx · .xls · .xlsm / 여러 파일</small></div>`:`<div class="dl-table-wrap"><table class="dl-table"><thead><tr><th class="dl-checkbox"><input type="checkbox" data-action="select-all" aria-label="표시된 파일 전체 선택" ${visible.length&&visible.every(e=>selected.has(e.id))?'checked':''}></th><th>상태</th><th class="dl-name-col">파일명</th><th>분류</th>${names.map(n=>`<th>${esc(n)}</th>`).join('')}</tr></thead><tbody>${visible.map(e=>`<tr data-entry="${e.id}" class="${selectedId===e.id?'selected':''} ${e.included?'':'excluded'}"><td class="dl-checkbox"><input type="checkbox" data-select="${e.id}" ${selected.has(e.id)?'checked':''} aria-label="${esc(e.name+' 선택')}"></td><td>${statusBadge(e)}</td><td class="dl-name-col"><button class="dl-filename" data-action="inspect" data-entry="${e.id}" title="${esc(e.name)}">${esc(e.name)}</button>${!e.included?'<small class="dl-excluded-label">처리 제외</small>':''}</td><td><select data-type="${e.id}" aria-label="${esc(e.name+' 분류')}"><option value="">${esc(e.result.classification?.type?.name||'분류 선택')}${e.result.classification?.type&&!e.typeId?' (자동)':''}</option>${process?.types.map(t=>`<option value="${esc(t.id)}" ${t.id===e.typeId?'selected':''}>${esc(t.name)}</option>`).join('')||''}</select>${e.typeId?'<small class="dl-manual">수정됨</small>':''}</td>${names.map(n=>valueCell(e,n)).join('')}</tr>`).join('')}</tbody></table>${!visible.length?'<div class="dl-no-matches">현재 필터에 해당하는 파일이 없습니다.</div>':''}</div><div class="dl-add-strip" data-action="add-files" role="button" tabindex="0">＋ 파일을 끌어 추가하거나 클릭하세요</div>`}</section>${showDetail?`<aside class="dl-detail">${detail()}</aside>`:''}</div>${notice?`<div class="dl-notice" role="status">${esc(notice)}</div>`:''}${confirmation?`<section class="dl-confirm" role="dialog" aria-label="처리 전 확인"><div><strong>${issues}개 파일을 확인해 주세요</strong><p>${gate.ready.length}개 처리 가능 · ${gate.warnings.length}개 확인 필요 · ${gate.blocked.length}개 미분류/오류/분석 중</p><small>제외되는 파일은 Result에 별도로 기록됩니다.</small></div><div><button data-action="cancel-process" class="dl-button">돌아가기</button><button data-action="run-ready" class="dl-button dl-primary" ${!gate.ready.length?'disabled':''}>확인된 ${gate.ready.length}개만 처리</button>${gate.warnings.length?`<button data-action="run-warnings" class="dl-button">확인 필요 ${gate.warnings.length}개도 포함</button>`:''}</div></section>`:''}<footer class="dl-footer"><div><strong>${entries.length}개 파일</strong><span>정상 ${counts.normal} · 확인 필요 ${counts.review} · 미분류 ${counts.unmatched} · 오류 ${counts.error}</span><small>처리 포함 ${gate.active.length} · 제외 ${entries.length-gate.active.length}</small></div><button data-action="process" class="dl-process-button" ${!process||!gate.active.length||gate.busy||processing?'disabled':''}>${processing?'처리 중…':'처리하기'} <span>→</span></button></footer></div>`;
      const sel=root.querySelector('[data-action="select-all"]');if(sel)sel.indeterminate=visible.some(e=>selected.has(e.id))&&!visible.every(e=>selected.has(e.id));
    }
    function schedule(){if(!renderTimer)renderTimer=setTimeout(()=>{renderTimer=null;render();},80);}
    async function readEntry(e){
      const generation=++e.generation;e.book=null;e.readError='';e.acknowledged=false;analyze(e);schedule();
      try{const book=await ProcessFiles.read(e.file);if(find(e.id)!==e||e.generation!==generation)return;e.book=book;}
      catch(err){if(find(e.id)!==e||e.generation!==generation)return;e.readError=err.message;}
      analyze(e);schedule();
    }
    async function addFiles(files){
      if(processing)return;const additions=Array.from(files).map(file=>({id:id(),name:file.name,size:file.size,file,book:null,readError:'',included:true,typeId:'',overrides:Object.create(null),editErrors:Object.create(null),drafts:Object.create(null),acknowledged:false,generation:0}));
      for(const e of additions){analyze(e);entries.push(e);}if(!selectedId)selectedId=additions[0]?.id||'';notice='';confirmation=false;render();
      let index=0;await Promise.all(Array.from({length:Math.min(3,additions.length)},async()=>{while(index<additions.length){const e=additions[index++];if(find(e.id))await readEntry(e);}}));render();
    }
    function modified(e){e.acknowledged=false;confirmation=false;analyze(e);render();}
    async function execute(allowWarnings){
      if(processing)return;for(const e of entries)analyze(e);
      const gate=LabelingCore.gate(entries);if(gate.busy){notice='파일 분석이 끝난 뒤 처리해 주세요.';render();return;}
      let snapshot;try{snapshot=LabelingCore.snapshot(entries,process,{allowWarnings});}catch(err){notice=err.message;render();return;}
      processing=true;confirmation=false;render();root?.querySelectorAll('input,button,select,textarea').forEach(el=>el.disabled=true);await new Promise(resolve=>requestAnimationFrame(resolve));
      try{onProcessed(snapshot);notice=snapshot.files.length+'개 파일 처리가 완료되었습니다.';}
      catch(err){notice=err.message;}finally{processing=false;render();}
    }
    function mount(content){
      root=content;root.classList.add('frame-content','labeling-content');loadInitial();
      const latest=ProcessStore.list().find(p=>p.id===processId);if(latest&&process&&JSON.stringify(latest)!==JSON.stringify(process))updated=true;
      const controller=new AbortController(),options={signal:controller.signal};
      const unsubscribe=ProcessStore.subscribe(()=>{const latest=ProcessStore.list().find(p=>p.id===processId);if(latest&&process&&JSON.stringify(latest)!==JSON.stringify(process))updated=true;if(!process){loadInitial();reanalyzeAll();}render();});
      root.addEventListener('input',event=>{if(event.target.dataset.role==='search'){search=event.target.value;const pos=event.target.selectionStart;render();const field=root.querySelector('[data-role="search"]');field.focus();field.setSelectionRange(pos,pos);}},options);
      root.addEventListener('change',event=>{
        const el=event.target;
        if(el.dataset.role==='files'){addFiles(el.files);el.value='';return;}
        if(el.dataset.role==='process'){processId=el.value;process=copy(ProcessStore.list().find(p=>p.id===processId)||null);updated=false;reanalyzeAll({reset:true});notice=entries.length?'새 Process를 적용했습니다. 이전 분류·수정값은 초기화했습니다.':'';render();return;}
        if(el.dataset.select){selected.has(el.dataset.select)?selected.delete(el.dataset.select):selected.add(el.dataset.select);render();return;}
        if(el.dataset.include){const e=find(el.dataset.include);e.included=el.checked;confirmation=false;render();return;}
        if(el.dataset.ack){find(el.dataset.ack).acknowledged=el.checked;render();return;}
        if(el.dataset.type){const e=find(el.dataset.type);e.typeId=el.value;e.overrides=Object.create(null);e.editErrors=Object.create(null);e.drafts=Object.create(null);modified(e);return;}
        if(el.dataset.edit){const e=find(el.dataset.entry),tag=definition(e,el.dataset.edit);e.drafts[el.dataset.edit]=el.value;try{e.overrides[el.dataset.edit]=[[LabelingCore.parseValue(el.value,tag.format)]];delete e.editErrors[el.dataset.edit];notice='';modified(e);}catch(err){e.editErrors[el.dataset.edit]=tag.name+': '+err.message;notice=err.message;modified(e);}}
      },options);
      root.addEventListener('click',event=>{
        const el=event.target.closest('[data-action]');
        if(!el){const row=event.target.closest('tbody tr');if(row&&!event.target.closest('input,select,textarea,button')){selectedId=row.dataset.entry;showDetail=true;render();}return;}
        if(event.target.tagName==='SELECT'||el.disabled)return;
        const action=el.dataset.action,e=find(el.dataset.entry);
        if(action==='add-files'){root.querySelector('[data-role="files"]').click();return;}
        if(action==='filter'){filter=el.dataset.filter;render();return;}
        if(action==='inspect'||action==='inspect-tag'){selectedId=e.id;showDetail=true;render();if(el.dataset.tag){const d=[...root.querySelectorAll('[data-tag-detail]')].find(x=>x.dataset.tagDetail===el.dataset.tag);if(d){d.open=true;d.scrollIntoView({block:'nearest'});}}return;}
        if(action==='toggle-detail'){showDetail=!showDetail;render();return;}
        if(action==='select-all'){const visible=entries.filter(e=>(filter==='all'||e.result.status===filter)&&e.name.toLowerCase().includes(search.toLowerCase()));visible.forEach(e=>el.checked?selected.add(e.id):selected.delete(e.id));render();return;}
        if(action==='default'){try{ProcessStore.setDefault(processId);notice='기본 Process로 지정했습니다.';}catch(_){notice='기본 Process를 저장하지 못했습니다.';}render();return;}
        if(action==='delete-selected'){entries=entries.filter(e=>!selected.has(e.id));selected.clear();if(!find(selectedId))selectedId=entries[0]?.id||'';confirmation=false;render();return;}
        if(action==='exclude-selected'){entries.forEach(e=>{if(selected.has(e.id))e.included=false;});selected.clear();confirmation=false;render();return;}
        if(action==='clear'){entries=[];selected.clear();selectedId='';confirmation=false;notice='';render();return;}
        if(action==='reset-one'){e.typeId='';e.overrides=Object.create(null);e.editErrors=Object.create(null);e.drafts=Object.create(null);modified(e);return;}
        if(action==='rerun-one'){notice='사용자 수정값을 유지하고 다시 분석합니다.';readEntry(e);render();return;}
        if(action==='reset-tag'){delete e.overrides[el.dataset.tag];delete e.editErrors[el.dataset.tag];modified(e);return;}
        if(action==='apply-grid'){const area=[...root.querySelectorAll('[data-grid]')].find(a=>a.dataset.entry===e.id&&a.dataset.grid===el.dataset.tag),tag=definition(e,el.dataset.tag);e.drafts[el.dataset.tag]=area.value;try{e.overrides[el.dataset.tag]=LabelingCore.parseGrid(area.value,tag.format);delete e.editErrors[el.dataset.tag];notice='';modified(e);}catch(err){e.editErrors[el.dataset.tag]=tag.name+': '+err.message;notice=err.message;modified(e);const d=[...root.querySelectorAll('[data-tag-detail]')].find(x=>x.dataset.tagDetail===el.dataset.tag);if(d)d.open=true;}return;}
        if(action==='reanalyze'){const newest=ProcessStore.list().find(p=>p.id===processId);if(newest){process=copy(newest);updated=false;}notice='사용자 수정값을 유지하고 다시 분석합니다.';for(const item of entries)readEntry(item);render();return;}
        if(action==='cancel-process'){confirmation=false;render();return;}
        if(action==='run-ready'){execute(false);return;}
        if(action==='run-warnings'){execute(true);return;}
        if(action==='process'){const gate=LabelingCore.gate(entries);
          if(process.processingPolicy==='normalOnly'){execute(false);return;}
          if(process.processingPolicy==='block'&&(gate.blocked.length||gate.warnings.length)){notice='이 Process는 모든 포함 파일의 분류·오류·확인이 해결되어야 처리할 수 있습니다.';render();return;}
          if(gate.blocked.length||gate.warnings.length){confirmation=true;render();}else execute(false);}
      },options);
      root.addEventListener('keydown',e=>{if(e.target.matches('.dl-dropzone,.dl-add-strip')&&['Enter',' '].includes(e.key)){e.preventDefault();root.querySelector('[data-role="files"]').click();}},options);
      root.addEventListener('dragover',e=>{if(e.dataTransfer.types.includes('Files')){e.preventDefault();root.classList.add('dl-dragging');}},options);
      root.addEventListener('dragleave',e=>{if(!root?.contains(e.relatedTarget))root?.classList.remove('dl-dragging');},options);
      root.addEventListener('drop',e=>{e.preventDefault();root.classList.remove('dl-dragging');addFiles(e.dataTransfer.files);},options);
      for(const entry of entries)analyze(entry);render();return ()=>{controller.abort();unsubscribe();clearTimeout(renderTimer);renderTimer=null;root=null;};
    }
    return Object.freeze({mount});
  }
  return Object.freeze({create});
})();

