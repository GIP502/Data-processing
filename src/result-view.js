/* Result owns a copied confirmed run. Selection and export never touch Labeling entries. */
window.ResultView=(()=>{
  'use strict';
  const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const ROWS=200,COLS=50,E=ResultExport;
  function create(){
    let snapshot=null,root=null,selected='all',selection=null,anchor=null,rowPage=0,colPage=0;
    let format='xlsx',copyScope='current',saveScope='current',header=true,name='',notice='',busy=false,drag=null,revision=0,dimensionsCache=new Map();
    const currentRows=()=>selected==='all'?snapshot?.rows:(snapshot?.files.find(f=>f.id===selected)?.rows);
    const isTable=()=>snapshot?.process.output.kind==='table';
    const currentName=()=>selected==='all'?'통합 결과':snapshot.files.find(f=>f.id===selected)?.name||'결과';
    function currentDimensions(){if(!dimensionsCache.has(selected))dimensionsCache.set(selected,E.dimensions(currentRows()));return dimensionsCache.get(selected);}
    function outputRows(scope){if(scope==='selection'&&!selection)throw Error('먼저 표에서 셀이나 범위를 선택하세요.');return E.matrix(currentRows(),scope==='selection'?selection:null,{table:isTable(),header});}
    function sheets(){return saveScope==='files'?snapshot.files.map(f=>({name:f.name,rows:E.matrix(f.rows,null,{table:isTable(),header})})):[{name:currentName(),rows:outputRows(saveScope)}];}
    function selectedCell(r,c){return selection&&r>=selection.r1&&r<=selection.r2&&c>=selection.c1&&c<=selection.c2;}
    function updateSelection(){
      if(!root||!snapshot)return;root.querySelectorAll('[data-cell]').forEach(el=>el.classList.toggle('chosen',!!selectedCell(Number(el.dataset.r),Number(el.dataset.c))));
      root.querySelectorAll('[data-row]').forEach(el=>el.classList.toggle('chosen',!!selection&&Number(el.dataset.row)>=selection.r1&&Number(el.dataset.row)<=selection.r2));
      root.querySelectorAll('[data-col]').forEach(el=>el.classList.toggle('chosen',!!selection&&Number(el.dataset.col)>=selection.c1&&Number(el.dataset.col)<=selection.c2));
      const label=selection?E.rangeName(selection)+' · '+(selection.r2-selection.r1+1)+'행 × '+(selection.c2-selection.c1+1)+'열':'선택 없음';
      root.querySelector('[data-selection-label]').textContent=label;root.querySelector('[data-range]').value=E.rangeName(selection);
      root.querySelectorAll('option[value="selection"]').forEach(el=>el.disabled=!selection);
      root.querySelector('[data-copy]').disabled=busy||(copyScope==='selection'&&!selection);
      root.querySelector('[data-save]').disabled=busy||(saveScope==='selection'&&!selection);
    }
    function showNotice(text){notice=text;if(root)root.querySelector('[data-notice]')?.replaceChildren(document.createTextNode(text));}
    function render(){
      if(!root)return;
      if(!snapshot){root.innerHTML='<div class="result-empty"><img src="assets/branding/result.png" alt=""><h2>확정된 결과를 기다리고 있습니다</h2><p>데이터 분류 · Data Labeling에서 검토한 뒤 처리하기를 누르세요.</p></div>';return;}
      const rows=currentRows()||[],d=currentDimensions();rowPage=Math.max(0,Math.min(rowPage,Math.ceil(d.height/ROWS)-1));colPage=Math.max(0,Math.min(colPage,Math.ceil(d.width/COLS)-1));
      const r0=rowPage*ROWS,c0=colPage*COLS,rEnd=Math.min(r0+ROWS,d.height),cEnd=Math.min(c0+COLS,d.width);
      root.innerHTML=`<div class="result-shell"><header><div><small>RESULT / 결과</small><h2>${esc(snapshot.process.name)}</h2><p>처리 완료 ${snapshot.files.length}개 · 제외 ${snapshot.skipped.length}개 · ${esc(new Date(snapshot.createdAt).toLocaleString('ko-KR'))}</p></div><img src="assets/branding/result.png" alt=""></header>
        <div class="result-workspace"><section class="result-main"><nav class="result-tabs" aria-label="결과 보기">${snapshot.rows?`<button data-file="all" class="${selected==='all'?'active':''}">통합 결과</button>`:''}${snapshot.files.map(f=>`<button data-file="${esc(f.id)}" class="${selected===f.id?'active':''}">${esc(f.name)}</button>`).join('')}</nav>
        <div class="result-grid-tools"><span data-selection-label></span><div><button data-action="select-all">전체 선택</button><button data-action="clear-selection">선택 해제</button></div></div>
        <div class="result-table-wrap" tabindex="0" aria-label="확정 결과 표. 방향키로 이동, Shift로 범위 선택, Ctrl+C로 복사"><table><thead><tr><th class="result-corner" data-action="select-all" title="전체 선택">▦</th>${Array.from({length:cEnd-c0},(_,j)=>`<th data-col="${j+c0}" title="열 선택">${E.colName(j+c0+1)}</th>`).join('')}</tr></thead><tbody>${rows.slice(r0,rEnd).map((r,i)=>`<tr><th data-row="${i+r0}" title="행 선택">${i+r0+1}</th>${Array.from({length:cEnd-c0},(_,j)=>`<td data-cell data-r="${i+r0}" data-c="${j+c0}" class="${isTable()&&i+r0===0?'result-title-cell':''}" title="${esc(r[j+c0])}">${esc(r[j+c0])}</td>`).join('')}</tr>`).join('')}</tbody></table></div>
        <div class="result-pagination"><span>총 ${d.height.toLocaleString()}행 · ${d.width}열</span><div><button data-page="row:-1" ${r0===0?'disabled':''}>‹</button><span>${r0+1}–${rEnd}행</span><button data-page="row:1" ${rEnd===d.height?'disabled':''}>›</button><button data-page="col:-1" ${c0===0?'disabled':''}>‹</button><span>${E.colName(c0+1)}–${E.colName(cEnd)}열</span><button data-page="col:1" ${cEnd===d.width?'disabled':''}>›</button></div></div>
        <details class="result-skipped"><summary>처리 기록 · 제외 ${snapshot.skipped.length}개 / 수정 ${snapshot.files.filter(f=>f.manualType||f.editedTags?.length).length}개</summary><div>${snapshot.skipped.map(f=>`<p><strong>${esc(f.name)}</strong><span>${esc(f.reason)}</span></p>`).join('')}${snapshot.files.filter(f=>f.manualType||f.editedTags?.length||f.warnings?.length).map(f=>`<p><strong>${esc(f.name)}</strong><span>${[f.manualType?'분류 수정: '+f.type:'',f.editedTags?.length?'값 수정: '+f.editedTags.join(', '):'',...(f.warnings||[])].filter(Boolean).map(esc).join(' · ')}</span></p>`).join('')||(!snapshot.skipped.length?'<p>모든 파일을 수정 없이 처리했습니다.</p>':'')}</div></details></section>
        <aside class="result-output"><div class="result-output-body"><div class="result-output-title"><small>EXPORT</small><h3>결과 가져가기</h3></div>
        <section><h4>셀 · 범위 선택</h4><div class="result-range-entry"><input data-range aria-label="선택 범위" placeholder="예: A2:C10"><button data-action="apply-range">선택</button></div><p class="result-hint">드래그 · Shift · 행/열 번호로 선택</p></section>
        <section><h4>클립보드 복사</h4><label><select data-copy-scope aria-label="복사 범위"><option value="current" ${copyScope==='current'?'selected':''}>현재 결과 전체</option><option value="selection" ${copyScope==='selection'?'selected':''}>선택한 범위</option></select></label><p class="result-hint">Excel에 바로 붙여넣을 수 있습니다.</p></section>
        <section><h4>파일로 저장</h4><label>파일 이름<input data-name value="${esc(name)}" aria-label="파일 이름"></label><div class="result-export-pair"><label>파일 형식<select data-format><option value="xlsx" ${format==='xlsx'?'selected':''}>Excel (.xlsx)</option><option value="csv" ${format==='csv'?'selected':''}>CSV (.csv)</option></select></label><label>저장 범위<select data-save-scope><option value="current" ${saveScope==='current'?'selected':''}>현재 결과 전체</option><option value="selection" ${saveScope==='selection'?'selected':''}>선택한 범위</option>${format==='xlsx'?`<option value="files" ${saveScope==='files'?'selected':''}>파일마다 시트</option>`:''}</select></label></div><p class="result-hint">${format==='xlsx'&&saveScope==='files'?'입력 파일마다 별도 시트를 만듭니다.':format==='csv'?'현재 결과 또는 선택 범위를 CSV로 저장합니다.':saveScope==='selection'?'선택한 범위를 하나의 시트에 저장합니다.':'현재 결과를 하나의 시트에 저장합니다.'}</p></section>
        ${isTable()?`<label class="result-check"><input type="checkbox" data-header ${header?'checked':''}>표 제목 포함 <small>복사·저장에 적용</small></label>`:'<p class="result-hint">지정한 셀 위치와 빈칸을 유지합니다.<br>선택 범위는 A1부터 출력합니다.</p>'}
        </div><div data-notice class="result-notice" role="status" aria-live="polite">${esc(notice)}</div><div class="result-output-actions"><button data-copy>복사 <span>Copy</span></button><button data-save class="result-save">파일로 저장 <span>Save</span></button></div><p class="result-hint result-frozen">확정된 결과입니다. 값을 바꾸려면 데이터 분류에서 수정 후 다시 처리하세요.</p></aside></div></div>`;
      updateSelection();
    }
    function setSnapshot(value){snapshot=JSON.parse(JSON.stringify(value));revision++;dimensionsCache.clear();selected=snapshot.rows?'all':snapshot.files[0]?.id;selection=null;anchor=null;rowPage=colPage=0;format='xlsx';copyScope='current';saveScope=snapshot.rows?'current':'files';header=true;name=snapshot.process.name+'_결과';notice='';drag=null;render();}
    function point(e){const cell=e.target.closest('[data-cell],[data-row],[data-col]');if(!cell)return null;if(cell.hasAttribute('data-cell'))return {r:Number(cell.dataset.r),c:Number(cell.dataset.c),kind:'cell'};if(cell.hasAttribute('data-row'))return {r:Number(cell.dataset.row),c:0,kind:'row'};return {r:0,c:Number(cell.dataset.col),kind:'col'};}
    function choose(p,extend){const d=currentDimensions();if(!extend||!anchor||anchor.kind!==p.kind)anchor=p;
      selection=p.kind==='row'?{r1:Math.min(anchor.r,p.r),r2:Math.max(anchor.r,p.r),c1:0,c2:d.width-1}:p.kind==='col'?{r1:0,r2:d.height-1,c1:Math.min(anchor.c,p.c),c2:Math.max(anchor.c,p.c)}:E.normalize(anchor,p);updateSelection();}
    async function copy(){
      const rev=revision;try{
        const rows=outputRows(copyScope);if(!rows.length)throw Error('복사할 데이터가 없습니다.');const text=E.tsv(rows);
        try{if(!navigator.clipboard?.writeText)throw Error('unavailable');await navigator.clipboard.writeText(text);}
        catch{
          const area=document.createElement('textarea');area.value=text;area.style.cssText='position:fixed;left:-9999px;top:0';document.body.append(area);area.select();
          let copied=false;try{copied=document.execCommand('copy');}finally{area.remove();}if(!copied)throw Error('복사가 허용되지 않았습니다. 표를 선택하고 Ctrl+C를 눌러주세요.');
        }
        if(rev===revision)showNotice(`${rows.length}행 × ${rows[0].length}열 복사 완료. Excel에 붙여넣으세요.`);
      }catch(e){if(rev===revision)showNotice(e.message);}
    }
    function download(blob,filename){const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=filename;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),60000);}
    async function save(){
      if(busy)return;const rev=revision,extension=format,filename=E.filename(name,extension),exportSheets=sheets();
      if(exportSheets.every(s=>!s.rows.length))throw Error('저장할 데이터가 없습니다. 제목 포함 여부와 선택 범위를 확인하세요.');
      const mime=extension==='xlsx'?'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet':'text/csv';
      busy=true;updateSelection();let handle=null;
      try{
        if(window.showSaveFilePicker){try{handle=await window.showSaveFilePicker({suggestedName:filename,types:[{description:extension==='xlsx'?'Excel 파일':'CSV 파일',accept:{[mime]:['.'+extension]}}]});}catch(e){if(!['SecurityError','NotSupportedError'].includes(e.name))throw e;}}
        const blob=extension==='xlsx'?new Blob([XLSX.write(E.workbook(exportSheets,XLSX),{bookType:'xlsx',type:'array',compression:true})],{type:mime}):new Blob([E.csv(exportSheets[0].rows)],{type:mime+';charset=utf-8'});
        if(handle){const writable=await handle.createWritable();try{await writable.write(blob);await writable.close();}catch(e){await writable.abort().catch(()=>{});throw e;}}
        else download(blob,filename);
        if(rev===revision)showNotice(handle?'파일을 저장했습니다.':`${filename} 다운로드를 시작했습니다. 저장 위치는 브라우저 설정을 따릅니다.`);
      }catch(e){if(rev===revision)showNotice(e.name==='AbortError'?'저장을 취소했습니다.':'저장하지 못했습니다: '+e.message);}
      finally{busy=false;updateSelection();}
    }
    function click(e){
      const file=e.target.closest('[data-file]');if(file){selected=file.dataset.file;selection=anchor=null;drag=null;rowPage=colPage=0;copyScope='current';if(saveScope==='selection')saveScope='current';notice='';render();return;}
      const page=e.target.closest('[data-page]');if(page){const [kind,delta]=page.dataset.page.split(':');if(kind==='row')rowPage+=Number(delta);else colPage+=Number(delta);render();return;}
      if(e.target.closest('[data-copy]')){copy();return;}if(e.target.closest('[data-save]')){save().catch(e=>showNotice(e.message));return;}
      const action=e.target.closest('[data-action]')?.dataset.action;
      if(action==='select-all'){const d=currentDimensions();selection={r1:0,r2:d.height-1,c1:0,c2:d.width-1};anchor={r:0,c:0,kind:'cell'};drag=null;updateSelection();}
      if(action==='clear-selection'){selection=anchor=null;drag=null;copyScope='current';if(saveScope==='selection')saveScope='current';render();}
      if(action==='apply-range'){try{selection=E.parseRange(root.querySelector('[data-range]').value,currentRows());anchor={r:selection.r1,c:selection.c1,kind:'cell'};drag=null;rowPage=Math.floor(selection.r1/ROWS);colPage=Math.floor(selection.c1/COLS);notice='';render();}catch(e){showNotice(e.message);}}
    }
    function change(e){
      if(e.target.matches('[data-name]'))name=e.target.value;
      if(e.target.matches('[data-copy-scope]')){copyScope=e.target.value;updateSelection();}
      if(e.target.matches('[data-save-scope]')){saveScope=e.target.value;render();}
      if(e.target.matches('[data-format]')){format=e.target.value;if(format==='csv'&&saveScope==='files')saveScope='current';render();}
      if(e.target.matches('[data-header]'))header=e.target.checked;
    }
    function keydown(e){
      if(e.target.matches('[data-range]')&&e.key==='Enter'){e.preventDefault();click({target:root.querySelector('[data-action="apply-range"]')});return;}
      if(!e.target.closest('.result-table-wrap'))return;
      if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='a'){e.preventDefault();click({target:root.querySelector('[data-action="select-all"]')});return;}
      if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='c'){e.preventDefault();copyScope=selection?'selection':'current';root.querySelector('[data-copy-scope]').value=copyScope;copy();return;}
      if(e.key==='Escape'){selection=anchor=null;drag=null;updateSelection();return;}
      const delta={ArrowLeft:[0,-1],ArrowRight:[0,1],ArrowUp:[-1,0],ArrowDown:[1,0]}[e.key];if(!delta)return;e.preventDefault();const d=currentDimensions();
      const p={r:Math.max(0,Math.min(d.height-1,(drag?.r??selection?.r2??0)+delta[0])),c:Math.max(0,Math.min(d.width-1,(drag?.c??selection?.c2??0)+delta[1])),kind:'cell'};
      choose(p,e.shiftKey);drag=p;const rp=Math.floor(p.r/ROWS),cp=Math.floor(p.c/COLS);if(rowPage!==rp||colPage!==cp){rowPage=rp;colPage=cp;render();}root.querySelector('.result-table-wrap').focus();root.querySelector(`[data-cell][data-r="${p.r}"][data-c="${p.c}"]`)?.scrollIntoView({block:'nearest',inline:'nearest'});
    }
    function mount(content){root=content;root.classList.add('frame-content','result-content');const controller=new AbortController(),options={signal:controller.signal};
      root.addEventListener('click',click,options);root.addEventListener('change',change,options);root.addEventListener('input',e=>{if(e.target.matches('[data-name]'))name=e.target.value;},options);root.addEventListener('keydown',keydown,options);
      root.addEventListener('pointerdown',e=>{if(e.button!==0)return;const p=point(e);if(!p)return;e.preventDefault();root.querySelector('.result-table-wrap').focus();choose(p,e.shiftKey);drag={...p,active:true};},options);
      root.addEventListener('pointerover',e=>{if(!drag?.active||!(e.buttons&1))return;const p=point(e);if(p&&p.kind===anchor.kind){choose(p,true);drag={...p,active:true};}},options);
      document.addEventListener('pointerup',()=>{if(drag)drag.active=false;},options);render();return()=>{controller.abort();drag=null;root=null;};}
    return Object.freeze({mount,setSnapshot});
  }
  return Object.freeze({create});
})();
