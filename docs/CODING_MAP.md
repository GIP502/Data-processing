# Coding Map

| 기능 | 파일 | 책임 / 공개 계약 |
|---|---|---|
| 앱 조립 | index.html, src/app.js | 세 이름·아이콘·크기, mount/dispose, 창 handle Map. onProcessed(snapshot) → ResultView.setSnapshot → Result 창 복원 |
| 창과 애니메이션 | window-manager.js, surface-motion.js, shell.css, motion.css | 위치·포커스·생명주기와 원본 모핑. 업무 데이터는 소유하지 않음 |
| 저장 Process | process-store.js | list/save/subscribe/defaultId/setDefault. 로컬 저장소와 변경 알림 소유. 기본 Process와 설정만 저장. 기존 키 유지, v1/v2 → ProcessCore.normalize, 읽기 시 저장소 쓰기 없음 |
| 설정 화면 | process-builder.js, process.css | 설정 config와 예시 파일 소유. ProcessStore로 저장. v3의 세 단계(파일/데이터·계산/결과) + 검수 범위/처리 정책. mount → dispose |
| 처리 규칙 | process-core.js | fresh/normalize/columnNumber/address/shape/classify/extract/compute/output/validate/evaluate(book,config,options). v2 동적 범위·시트 순서·가로/세로 목록·표 열 선택, v1 범위 유지. 순수 규칙. options.typeId / values로 검수 수정 적용 |
| Excel 어댑터 | process-files.js, assets/vendor/sheetjs | read(File) → Workbook. Workbook={name,sheets:[{name,rows}]}. 오류 셀은 {error}로 전달. 수식/매크로 실행 없음 |
| 검수 법칙 | labeling-core.js | analyze(entry,process), columns, parseValue/Grid, gate, snapshot. 상태·검수 기준·실행 정책 및 복사된 확정 결과. DOM/파일 입출력 없음 |
| 검수 화면/상태 | data-labeling.js, labeling.css | 입력 File/Workbook, 포함·선택·수동 유형·overrides·invalid drafts·확인 상태 소유. 파일 표/상세/필터. 3개 동시 읽기, 세대 번호로 삭제 후 늦은 응답 무효화 |
| 확정 결과 화면/입출력 | result-view.js, result.css | create → mount/dispose, setSnapshot이 확정본 복사. 통합/파일별 탭, 셀/행/열/범위·키보드 선택, 페이지, 출력 옵션·기록. 클립보드/저장 대화상자/다운로드 소유. Labeling 내부 상태에 의존하지 않음 |
| 결과 출력 규칙 | result-export.js | dimensions/parseRange/normalize/rangeName/matrix/tsv/csv/filename/sheetName/workbook. DOM/브라우저 입출력 없음. workbook은 명시적 SheetJS 인자를 사용. 행렬을 복사해 제목·범위 규칙 적용, 안전한 이름과 Excel 한도 검사 |
| Windows 실행 | START-WINDOW.vbs, launcher | 전용 Chrome/Edge 프로필의 --app, Shell ID, WM_SETICON과 HICON 수명 관리 |

흐름: Builder → ProcessStore → Labeling의 Process 복사본 → ProcessFiles → LabelingCore.analyze → ProcessCore.evaluate(typeId,values) → 검수 UI → 명시적 처리 클릭 → 재평가/정책 검사 → LabelingCore.snapshot → Result.

수정 권한: 원본 Workbook은 읽기만 합니다. corrections는 entry.overrides에 별도 보관합니다. 자동 추출값과 수정값을 혼합해 원본 객체를 수정하지 않습니다. 최종 Process/tag/rows는 JSON 복사되어 Result가 독립적으로 소유합니다.

삭제/비우기는 진행 중 읽기의 늦은 결과를 무효화합니다. Process 변경은 이전 수정값을 초기화합니다. 재분석은 수정값을 유지합니다. 값/분류 변경은 확인 완료 상태를 취소합니다. 같은 Process가 새로 저장되면 안내 후 재분석으로 적용합니다.

수정 위치: 계산·좌표 법칙은 process-core, 파일 형식은 process-files, 검수 판정과 처리 정책은 labeling-core, 표 편집·선택·비동기 상태는 data-labeling, 검수 배치는 labeling.css. 확정 결과의 선택·출력 UI와 브라우저 입출력은 result-view, 직렬화·이름·범위 법칙은 result-export, 배치는 result.css. 설정·검수 창은 다른 모듈의 내부 DOM을 참조하지 않습니다. app.js는 공용 계약으로 연결하고 onClose에서 dispose를 호출합니다.

검증: process-core.test.cjs, labeling-core.test.cjs, surface-motion.test.cjs, result-export.test.cjs, process-v2.test.cjs, process-merge.test.cjs. 52개 규칙 테스트. 별도 Edge 브라우저 검사에서 기존 Labeling 흐름과 실제 클립보드, XLSX/CSV 다운로드/왕복, 범위/페이지 선택, 파일별 시트, 좌표 유지, 저장 취소 계약, 좁은 창을 확인했습니다. v3 UI에서 저장 → Labeling 검수/수정 → Result를 추가 확인했습니다. OS 저장 대화상자는 자동 검사하지 않았습니다.
