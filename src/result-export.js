/* Pure output rules. Confirmed matrices stay read-only; browser I/O belongs to ResultView. */
window.ResultExport=(()=>{
  'use strict';
  function dimensions(rows){return {height:rows?.length||0,width:(rows||[]).reduce((n,r)=>Math.max(n,r.length),0)};}
  function colName(n){let s='';while(n>0){n--;s=String.fromCharCode(65+n%26)+s;n=Math.floor(n/26);}return s;}
  function normalize(a,b){return {r1:Math.min(a.r,b.r),r2:Math.max(a.r,b.r),c1:Math.min(a.c,b.c),c2:Math.max(a.c,b.c)};}
  function parseRange(text,rows){
    const m=String(text).trim().toUpperCase().match(/^([A-Z]+)([1-9]\d*)(?::([A-Z]+)([1-9]\d*))?$/);
    if(!m)throw Error('A1 또는 A1:C10 형태로 입력하세요.');
    const col=s=>Array.from(s).reduce((n,c)=>n*26+c.charCodeAt(0)-64,0)-1;
    const range=normalize({r:Number(m[2])-1,c:col(m[1])},{r:Number(m[4]||m[2])-1,c:col(m[3]||m[1])});
    const d=dimensions(rows);if(range.r2>=d.height||range.c2>=d.width)throw Error('결과 표 안의 범위를 지정하세요.');return range;
  }
  function rangeName(s){if(!s)return '';const a=colName(s.c1+1)+(s.r1+1),b=colName(s.c2+1)+(s.r2+1);return a===b?a:a+':'+b;}
  function matrix(rows,selection=null,{table=false,header=true}={}){
    const d=dimensions(rows);if(!d.height||!d.width)return [];
    const s=selection||{r1:0,r2:d.height-1,c1:0,c2:d.width-1};
    if(s.r1<0||s.c1<0||s.r2>=d.height||s.c2>=d.width||s.r1>s.r2||s.c1>s.c2)throw Error('선택 범위가 결과 표를 벗어났습니다.');
    const result=[];
    if(table&&header&&s.r1>0)result.push(Array.from({length:s.c2-s.c1+1},(_,j)=>rows[0]?.[s.c1+j]??null));
    for(let i=s.r1;i<=s.r2;i++){if(table&&!header&&i===0)continue;result.push(Array.from({length:s.c2-s.c1+1},(_,j)=>rows[i]?.[s.c1+j]??null));}
    return result;
  }
  const field=(v,delimiter)=>{const s=String(v??'');return s.includes(delimiter)||/["\r\n]/.test(s)?'"'+s.replace(/"/g,'""')+'"':s;};
  function delimited(rows,delimiter){return rows.map(r=>r.map(v=>field(v,delimiter)).join(delimiter)).join('\r\n');}
  function tsv(rows){return delimited(rows,'\t');}
  function csv(rows){return '\uFEFF'+delimited(rows,',');}
  function filename(value,extension){
    let s=String(value||'결과').replace(/\.(xlsx|csv)$/i,'').replace(/[<>:"/\\|?*\x00-\x1f]/g,'_').trim().slice(0,120).replace(/[. ]+$/,'')||'결과';
    if(/^(CON|PRN|AUX|NUL|COM[1-9]|LPT[1-9])(?:\.|$)/i.test(s))s='_'+s;
    return s+'.'+extension;
  }
  function sheetName(value,used){
    let base=String(value||'결과').replace(/\.xls[xm]?$/i,'').replace(/[\[\]:*?/\\\x00-\x1f]/g,'_').replace(/^'+|'+$/g,'').trim()||'결과';
    const clip=(s,n)=>s.slice(0,n).replace(/[\uD800-\uDBFF]$/,'');let name=clip(base,31),i=2;
    while(used.has(name.toLowerCase())){const suffix=' ('+(i++)+')';name=clip(base,31-suffix.length)+suffix;}
    used.add(name.toLowerCase());return name;
  }
  function workbook(sheets,xlsx){
    if(!sheets.length)throw Error('저장할 결과가 없습니다.');const book=xlsx.utils.book_new(),used=new Set();
    sheets.forEach(s=>{const d=dimensions(s.rows);if(d.height>1048576||d.width>16384)throw Error('Excel 한 시트의 행·열 한도를 넘었습니다. 파일마다 시트로 저장하거나 범위를 나누세요.');xlsx.utils.book_append_sheet(book,xlsx.utils.aoa_to_sheet(s.rows),sheetName(s.name,used));});return book;
  }
  return Object.freeze({dimensions,colName,parseRange,normalize,rangeName,matrix,tsv,csv,filename,sheetName,workbook});
})();
