# Process 규칙 계약 v2

Process Builder는 사용자에게 **파일 나누기 → 데이터 가져오기 → 결과 만들기**의 3단계로 보입니다. Value/List/Table 같은 내부 타입 이름은 기본 UI에 노출하지 않고 한 셀/한 줄/표 범위처럼 설명합니다. 내부 규칙은 결정론적으로 실행하며, 규칙 밖의 값이나 애매한 경우를 자동 추측하지 않습니다. 실행 중 분류 실패, 길이 불일치, 잘못된 데이터 형태 등은 이후 Data Labeling에서 오류로 검수하는 것을 원칙으로 합니다.

## 1. 파일 나누기 (`types`)

각 유형은 `id/name/mode(all|any)/conditions`로 구성합니다.

조건 종류:
- `filename`: 파일명 전체 비교
- `filename-token`: 확장자를 제외한 파일명을 구분자로 나눈 뒤 N번째 값 비교
- `cell`: 지정 시트의 지정 셀 값 비교
- `sheet`: 시트명 비교(고급 호환 기능)

비교 연산: `contains`, `not-contains`, `equals`, `not-equals`, `starts`, `ends`.
셀 조건은 시트를 이름(`sheetMode=name`) 또는 순서(`sheetMode=index`)로 지정할 수 있습니다. 정확히 한 유형에 일치해야 정상 분류이며, 0개는 미분류, 2개 이상은 분류 충돌입니다.

## 2. 데이터 가져오기 (`tags`)

UI에서는 tag라는 말을 쓰지 않고 **가져올 값 / 항목**으로 표시합니다. 추출 결과는 내부적으로 항상 2차원 배열입니다.

- `cell` → **Value**: 값 하나
- `row`, `column` → **List**: 1차원 데이터
- `range` → **Table**: 행×열 2차원 데이터

공통 필드: `id/type/name/sheetMode/sheet/sheetIndex/kind/start/format`.
`start`는 A1 주소 형식입니다. 좌표는 1부터 시작합니다. `format=auto|number|text`를 지원합니다.

### 동적 범위

행 끝은 `endRowMode`, 열 끝은 `endColumnMode`로 정합니다.

- `fixed`: 고정 행/열 번호
- `last-data`: 기준 열/행에서 마지막으로 값이 있는 위치까지
- `until-blank`: 시작점부터 진행하다 첫 빈 셀 직전까지

행 기준 열은 `endRowBy`에 A/B 또는 1/2 형식으로 지정합니다. 열 기준 행은 `endColumnBy`에 행 번호로 지정합니다. Table은 행 끝과 열 끝을 각각 독립적으로 고정/동적으로 설정할 수 있습니다.

## 3. 계산 데이터 (`steps`)

계산은 데이터 단계 안에서 새 데이터 항목을 만드는 방식으로 표시합니다.

필드: `id/type/input/op/rightKind(number|tag)/right/result`.
연산: `none|multiply|divide|add|subtract|sum|average`.

규칙:
- Value는 다른 List/Table에 자동 반복 적용할 수 있습니다.
- List끼리는 방향(가로/세로)이 달라도 길이가 같으면 위치 순서대로 계산합니다.
- Table끼리는 행·열 크기가 같아야 합니다.
- 빈값, 비숫자, 0 나눗셈, 길이/크기 불일치는 오류입니다.
- 계산 의존 순서는 자동으로 해결하며 누락·순환 참조는 오류입니다.

## 4. 결과 (`output`)

`output.kind=table|position`.

### Result Table

각 결과 열은 `id/label/tag/tableColumn`을 가집니다.

- Value: 결과 행마다 반복
- List: List 길이만큼 결과 행 생성
- 여러 List: 길이가 모두 같아야 함
- Table: `tableColumn`으로 사용할 열 번호(1부터)를 지정해 List로 사용
- 파일 하나가 반드시 결과 1행을 만들 필요는 없음
- 길이 불일치나 존재하지 않는 Table 열은 자동 보정하지 않고 오류

### 지정 위치 출력

각 항목은 `target(A1)`부터 원래 Value/List/Table 모양대로 배치합니다. 배치 영역이 겹치면 오류입니다.

## 5. 예시 파일 및 안전 원칙

Process Builder는 `.xlsx/.xls/.xlsm` 예시 파일을 읽어 분류, 추출, 계산, 출력 결과를 미리 보여줍니다. 예시 파일 원본을 수정하지 않습니다. Excel 수식은 파일에 저장된 계산 결과를 읽고 재계산하거나 매크로를 실행하지 않습니다.

## 6. 기존 버전 호환성
- `normalize(raw)`는 설정을 복사해 version 2로 정규화합니다. v1 row/column은 start 주소로 변환하며 id, 검수 min/max/review, processingPolicy를 유지합니다.
- v1에서 열/행 추출의 끝이 빈칸이었다면 `sheet-end`로 보관합니다. 이전처럼 시트 전체의 마지막 행/열까지 읽으며 새 anchor 기준 `last-data`로 임의 변경하지 않습니다. 설정 UI에는 기존 설정에서만 이 선택지를 표시합니다.
- 새로운 설정은 last-data 또는 until-blank를 사용하여 기준 열/행에서 범위를 판단합니다. 표의 행/열 끝을 각각 지정할 수 있습니다.
- 공개 평가 계약 `evaluate(book,config,{typeId,values})`를 유지합니다. typeId는 수동 분류, values는 원본 항목 이름 → 수정된 2차원 배열입니다. 수정값을 우선해 종속 계산 및 출력도 다시 수행하며 Workbook/Process 원본은 변경하지 않습니다.
- ProcessStore는 기존 저장 키를 유지하고 v1/v2 목록을 받아 정규화합니다. 목록 읽기는 저장소에 쓰지 않고 저장할 때 v2로 기록합니다. 기본 Process ID와 같은 창 사이 변경 알림을 유지합니다.
- tag.min/max/review와 processingPolicy(prompt/block/normalOnly)는 Labeling의 검수·실행 정책입니다. 데이터 가져오기 / 결과 만들기에서 편집합니다.
- Excel 오류 셀은 추출 실패이며 문자 항목에서도 오류가 됩니다. 계산 결과가 무한대 또는 NaN이면 실패합니다. 잘못된 기존 좌표를 정상 주소로 자동 보정하지 않습니다.
- 실제 일괄 검수·처리와 통합 결과/파일별 시트·Excel/CSV/클립보드 출력은 기존 Labeling/Result 모듈을 사용합니다.
