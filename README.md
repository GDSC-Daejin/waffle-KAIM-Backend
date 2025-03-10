# waffle-KAIM-Backend

JJ-IM이 제작하고 있는 KAIM 백엔드 입니다
혼자 만드는거여서 설명이 조금 적을 수 있으니 양해바랍니다.

언어는 NodeJS를 사용하고 DB는 MongoDB를 사용했습니다

현재 DB를 최근 3일 조회하는 명령어

```bash
node scripts/printDates.js
```

예측 더미 데이터 생성기
```bash
node scripts/insertPredictData.js
```

백엔드 서버 기능은 아직 제작중입니다

## 대쉬보드 부분 API 작업할 내용

### ( 이 데이터들은 Redis에 업로드 )

- 대쉬보드 상단 정보바 API (오늘의 환율, 국제유가, 기준 금리, 한국 GDP) + (각 지난 분기 데이터 변화값 적용)

- 막대 그래프 : 지역별 당일 유가 (3종 유류 당일 가격) + 3종유류 평균 이번주 가격과 지난주 가격 비교 가격 (10초마다 수치 변경해서 적용 예정)
- 곡선 그래프 : 전국 평균 유가 4종 7일치 + 예측 전국 평균 유가 3일치
- 하단 전국 + 지역별 유가 현재 4종 + 어제 가격 (비교 후 작업 예정)
- 전국 평균 유가 + 현재 7일 값과 그 이전 7일 값의 차이

## 상세 페이지 부분 API 작업 내용

- 조회하는 요일에 대한 입력값이 들어오면 DB에 조회하여 정보를 제공 + 어제 값과 비교 데이터 제공
  (/detail-api [POST Date]) 미완

## API 순서대로

#### (/dashboard-api/nav-info) 완

#### (/dashboard-api/bar-graph) 완

#### (/dashboard-api/linear-graph) 완

#### (/dashboard-api/comparison) 완

#### (/dashboard-api/national-average) 완

#### (/detail-api [POST Date]) 미완

## 현재 구상 정리

1. index.js에서 Express 앱을 생성하고 API 라우터를 설정할 생각입니다.
2. /routes 폴더에 API 관련 파일을 두어 엔드포인트를 분리할 생각입니다.
3. /config 폴더에 Redis 연결 설정 파일을 두어 캐싱 기능을 구현할 생각입니다.
4. /jobs 폴더에 node-cron을 이용한 스케줄러를 추가하여 오전 5시 주기로 DB 데이터를 가져와 Redis에 캐싱하도록 할 생각입니다.
