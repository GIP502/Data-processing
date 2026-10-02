# Result 계약

입력은 LabelingCore.snapshot의 RunSnapshot={id,createdAt,process,files,skipped,rows}. ResultView.create()는 mount(content)→dispose와 setSnapshot(snapshot)을 제공합니다. 기존 app.js의 onProcessed 연결은 유지합니다. setSnapshot은 확정본을 복사하고 선택/출력 옵션을 초기화합니다. 내부 창 닫기(dispose)는 메모리 결과/옵션을 지우지 않습니다. 앱 종료 시 결과는 사라집니다.

상태는 ResultView에만 있습니다: snapshot, 파일 탭(all/파일 ID), 범위 selection, anchor, 행/열 페이지, 복사/저장 범위, 형식, 제목 포함, 파일 이름, 알림, 저장 중 여부. Labeling entries와 원본 Excel을 참조하거나 변경하지 않습니다. 새 snapshot이 오면 이전 비동기 복사/저장 알림이 새 결과를 덮지 않도록 revision을 검사합니다. 저장은 클릭 당시 데이터/옵션을 사용합니다.

왼쪽 ⅔: 통합/파일별 탭 → 선택 도구 → 표 → 페이지 → 접힌 처리 기록. 오른쪽 ⅓: 범위 입력 → 복사 범위 → 파일 이름/형식/저장 범위 → 제목 포함 → 복사/저장. 좁은 창의 출력 옵션은 스크롤되며 더 좁으면 표 아래로 이동합니다. 처리 완료/제외 수와 시각은 상단에 표시합니다.

선택 좌표는 0부터 시작하는 {r1,r2,c1,c2}이며 원본 확정 행렬의 위치입니다. 화면 주소는 A1부터 시작합니다. table에서 1행은 Process 출력 제목입니다. 클릭·드래그·Shift·행/열 머리글·방향키·직접 범위 입력을 지원합니다. 페이지(200행/50열)는 표시만 분할하며 선택/전체 출력은 전체 행렬 기준입니다. 범위 입력은 현재 표 내부인지 검사하고 뒤집힌 모서리는 정규화합니다. 화면 셀을 직접 편집하지 않습니다.

ResultExport는 순수 출력 규칙을 제공합니다.
- dimensions/colName/parseRange/normalize/rangeName: 좌표와 범위 법칙.
- matrix(rows,selection,{table,header}): 독립적인 직사각형 행렬. 짧은 행의 빈칸은 null. 표 제목 제외 시 원본 1행만 제외. 제목 포함 시 데이터 선택 위에 해당 열의 제목을 한 번 추가. position 출력은 제목을 추가/삭제하지 않음.
- tsv/csv: Tab 또는 쉼표 구분, CRLF 행 구분. 구분자·따옴표·줄바꿈이 있는 셀은 따옴표 인용 및 내부 따옴표 두 번. CSV는 UTF-8 BOM.
- filename/sheetName: Windows 금지 문자/장치 이름 처리, .xlsx/.csv 확장자, Excel 시트 이름 31자·금지 문자·대소문자 중복 처리.
- workbook(sheets,xlsx): 명시적 SheetJS 어댑터로 새 Workbook 생성. Excel 1,048,576행/16,384열 한도 초과는 실패. 값의 숫자/문자 타입 유지, 문자열을 수식으로 만들지 않음. metadata 열을 삽입하지 않음.

복사: 현재 결과 전체 또는 선택. navigator.clipboard.writeText 우선, 실패 시 선택한 textarea의 브라우저 복사 명령으로 폴백. Ctrl+C는 표에 포커스가 있을 때 선택 범위(없으면 전체)를 복사합니다.

저장: Excel은 현재 결과/선택 범위 한 시트 또는 입력 파일마다 한 시트. CSV는 현재 결과/선택 범위만 제공. position의 전체 출력은 빈칸/좌표 유지, 선택 출력은 선택 시작을 A1로 이동. table은 제목 포함 옵션을 적용. 위치 출력의 기본 저장은 파일별 시트, 표 출력의 기본 저장은 통합 결과 한 시트입니다.

브라우저가 허용하면 클릭 시 showSaveFilePicker를 먼저 호출하고 선택한 핸들에 기록합니다. 지원하지 않거나 SecurityError/NotSupportedError이면 Blob 다운로드. 취소(AbortError)는 다운로드하지 않음. 쓰기 실패 시 스트림을 취소하고 오류 표시. 저장 중 복사/저장 버튼을 막으며 종료/취소/실패 후 복구합니다. OS 파일 선택창 자체는 브라우저가 제공합니다.

처리 기록은 확정본의 skipped(name/reason), 수동 분류, editedTags, warnings만 표시합니다. Labeling에서 전달한 제외 이유는 현재 상태명이며 상세 원본 오류 메시지는 Labeling에서 확인합니다. 새로운 처리만 Result 내용을 바꿉니다.

검증: result-export.test.cjs에서 범위·제목·인용·이름·타입/좌표 왕복·Excel 한도. 실제 Edge에서 Labeling→Result, 네이티브 클립보드, XLSX/CSV 다운로드 후 내용 검증, 큰 표 선택/전체 출력, 파일별 시트, position, 재마운트·반응형. 저장 핸들 호출/쓰기/취소는 대체 핸들로 검증.
