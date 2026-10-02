const {test}=require('node:test'),assert=require('node:assert/strict');
global.window=global;require('../src/result-export.js');const E=global.ResultExport,XLSX=require('../assets/vendor/sheetjs/xlsx.full.min.js');
test('cell ranges normalize reversed corners and reject invalid/outside coordinates',()=>{
  const rows=Array.from({length:300},()=>Array(60).fill(null));
  assert.deepEqual(E.parseRange('bh300:a2',rows),{r1:1,r2:299,c1:0,c2:59});assert.equal(E.rangeName(E.parseRange('aa20',rows)),'AA20');
  for(const s of ['A0','A1:B301','BI1','A1 C2','A-1'])assert.throws(()=>E.parseRange(s,rows));
});
test('full exports span all pages, preserve ragged blanks and do not mutate confirmed rows',()=>{
  const rows=[['이름','값'],...Array.from({length:401},(_,i)=>['파일'+i,i])],before=JSON.stringify(rows),result=E.matrix(rows,null,{table:true,header:true});
  assert.equal(result.length,402);result[1][0]='changed';assert.equal(JSON.stringify(rows),before);
  assert.deepEqual(E.matrix([[null],[null,2]]),[[null,null],[null,2]]);
});
test('table selection optionally adds only matching titles; positioned selection never adds a title',()=>{
  const rows=[['이름','값','단가'],['가',100,20],['나',200,40]],s={r1:1,r2:2,c1:1,c2:2};
  assert.deepEqual(E.matrix(rows,s,{table:true}),[['값','단가'],[100,20],[200,40]]);
  assert.deepEqual(E.matrix(rows,s,{table:true,header:false}),[[100,20],[200,40]]);
  assert.deepEqual(E.matrix(rows,s,{table:false}),[[100,20],[200,40]]);
  assert.deepEqual(E.matrix(rows,{r1:0,r2:1,c1:0,c2:0},{table:true}),[['이름'],['가']]);
});
test('CSV and TSV escape separators, quotes and newlines while preserving zero/false/Unicode',()=>{
  const rows=[['한글',0,false,null],['a,b','a\tb','a"b','a\nb']];
  assert.equal(E.csv(rows),'\uFEFF한글,0,false,\r\n"a,b",a\tb,"a""b","a\nb"');
  assert.equal(E.tsv(rows),'한글\t0\tfalse\t\r\na,b\t"a\tb"\t"a""b"\t"a\nb"');
});
test('Excel sheets have unique case-insensitive valid names including truncated collisions',()=>{
  const used=new Set(),values=['a/b.xlsx','A_B.xls','x'.repeat(40),'x'.repeat(40),'\'\'','😀'.repeat(30)];
  const names=values.map(v=>E.sheetName(v,used));assert.equal(names[0],'a_b');assert.equal(names[1],'A_B (2)');
  assert(names.every(n=>n.length<=31&&!/[\[\]:*?/\\]/.test(n)));assert.equal(new Set(names.map(s=>s.toLowerCase())).size,6);
});
test('Excel roundtrip keeps numbers, literal formula-like text, output titles and positioned blanks',()=>{
  const sheets=[{name:'통합 결과',rows:[['태그','값'],['=SUM(A1:A2)',12.5],['00123',0]]},{name:'위치',rows:[[null,null],[null,null,'문자'],[null,null,33]]}];
  const wb=E.workbook(sheets,XLSX),r=XLSX.read(XLSX.write(wb,{type:'buffer',bookType:'xlsx'}),{type:'buffer'});
  assert.equal(r.Sheets['통합 결과'].A2.v,'=SUM(A1:A2)');assert.equal(r.Sheets['통합 결과'].A2.t,'s');assert.equal(r.Sheets['통합 결과'].A2.f,undefined);
  assert.equal(r.Sheets['통합 결과'].B2.v,12.5);assert.equal(r.Sheets['통합 결과'].A3.v,'00123');assert.equal(r.Sheets['위치'].C3.v,33);assert.equal(r.Sheets['위치'].C2.v,'문자');assert.equal(r.Sheets['위치'].A1,undefined);
});
test('Windows filenames remove forbidden characters and reserved device names',()=>{
  assert.equal(E.filename('월간/결과.xlsx','csv'),'월간_결과.csv');assert.equal(E.filename('CON','xlsx'),'_CON.xlsx');assert.equal(E.filename('','xlsx'),'결과.xlsx');
});
test('Excel limits fail explicitly rather than truncating output silently',()=>{
  assert.throws(()=>E.workbook([{name:'large',rows:new Array(1048577).fill([1])}],XLSX),/한도/);
  assert.throws(()=>E.workbook([{name:'wide',rows:[new Array(16385).fill(1)]}],XLSX),/한도/);
});
