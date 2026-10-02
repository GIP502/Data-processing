# Data Labeling 계약

Entry={id,name,size,file,book,readError,included,typeId,overrides,editErrors,drafts,acknowledged,generation,result}.

자동 데이터는 book에 보관하고 읽기만 합니다. typeId는 수동 분류(빈 문자열이면 자동). overrides는 tag 이름 → 2차원 값 배열. editErrors/drafts는 적용에 실패한 사용자 입력을 보관하며 오류가 남으면 처리하지 않습니다. acknowledged는 경고 확인이며 값·분류·재분석 때 취소합니다. generation과 entry의 생존 여부로 늦은 파일 응답을 무효화합니다.

상태: reading / waiting / normal / review / unmatched / error. 분류 충돌은 review지만 출력이 없으므로 분류를 지정해야 합니다. 원본/계산 tag 빈값, min/max 초과, review=always는 경고입니다. 읽기 실패·추출 실패·숫자/계산/출력 오류는 error이며 rows=null입니다. 기본 확인 상태는 행별로 체크할 수 있습니다.

Process 확장(기존 v1 호환): tag.min / tag.max(선택 숫자), tag.review(normal|always), processingPolicy(prompt|block|normalOnly, 생략 시 prompt). Process Builder의 변수 설정 / 출력 설정에서 편집합니다.

ProcessCore.evaluate의 선택 인자 options={typeId,values}. 원본 tag 수정값이 있으면 원본 추출보다 우선하며 결과 계산은 다시 수행합니다. 계산 tag는 직접 편집하지 않고 원본 수정으로 갱신합니다. 원본 Workbook은 변경하지 않습니다.

실행: 포함 파일만 고려합니다. prompt는 문제 파일이 있으면 화면에 선택을 제시합니다. block은 모든 포함 파일의 분류·오류·확인이 해결되어야 합니다. normalOnly는 정상 파일만 선택합니다. 입력·분류·수정만으로 실행하지 않습니다. 포함된 파일이 분석 중이면 실행을 막습니다. 미분류·분류 충돌·오류는 경고 포함 선택으로도 처리할 수 없습니다.

RunSnapshot={id,createdAt,process,files,skipped,rows}. files는 확정된 name/type/editedTags/warnings/tags/rows를 가집니다. skipped에는 파일명과 제외 원인이 있습니다. 표 출력은 헤더가 같은 파일의 행을 이어 붙이고, 지정 위치 출력은 각 파일의 독립 결과를 보관합니다. 모든 설정·배열은 복사본입니다. ResultView는 확정본만 받습니다.

저장: Process와 기본 Process ID만 로컬 저장합니다. 파일·검수 수정값·결과는 메모리만 사용합니다. ResultView가 복사·파일 저장을 담당합니다. 결과 계약은 RESULT_SPEC.md에 있습니다.
