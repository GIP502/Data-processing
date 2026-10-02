/* Offline Excel adapter. Workbook contract stays {name,sheets:[{name,rows}]}. */
window.ProcessFiles=(()=>{
  'use strict';
  async function read(file){
    if(!/\.(xlsx|xlsm|xls)$/i.test(file.name))throw Error('지원 형식은 .xlsx, .xls, .xlsm입니다.');
    if(file.size>50*1024*1024)throw Error('파일은 50MB 이하로 넣어 주세요.');
    const bytes=new Uint8Array(await file.arrayBuffer());
    const cfb=bytes[0]===0xd0&&bytes[1]===0xcf,zip=bytes[0]===0x50&&bytes[1]===0x4b,biff=bytes[0]===0x09;
    if(!cfb&&!zip&&!biff)throw Error('Excel 파일 형식이 아니거나 파일이 손상되었습니다.');
    let wb;try{wb=XLSX.read(bytes,{type:'array',cellFormula:false,cellDates:false,bookVBA:false});}
    catch(e){throw Error(/password|encrypt/i.test(e.message)?'암호화된 Excel 파일은 읽을 수 없습니다.':('Excel 파일을 읽을 수 없습니다: '+e.message));}
    const sheets=[];
    for(const name of wb.SheetNames){
      const source=wb.Sheets[name],rows=[];let count=0;
      for(const key of Object.keys(source)){
        if(key.startsWith('!'))continue;
        const position=XLSX.utils.decode_cell(key),cell=source[key];
        if(position.r>=100000||position.c>=1000||++count>200000)throw Error(name+': 시트당 100,000행 / 1,000열 / 200,000셀까지 읽습니다.');
        if(!rows[position.r])rows[position.r]=[];
        rows[position.r][position.c]=cell.t==='e'?{error:cell.w||'#ERROR '+cell.v}:(cell.v??null);
      }
      sheets.push({name,rows:Array.from({length:rows.length},(_,i)=>rows[i]||[])});
    }
    if(!sheets.length)throw Error('읽을 수 있는 시트가 없습니다.');
    return {name:file.name,sheets};
  }
  return Object.freeze({read});
})();
