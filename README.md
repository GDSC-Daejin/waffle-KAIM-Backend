# waffle-KAIM-Backend

KAIM의 백엔드입니다

JJ-IM이 주도적으로 제작을 합니다

1. 기본 NodeJS + Express 프로젝트를 생성합니다.
   - package.json 파일에 필요한 의존성(express, redis, node-cron 등)을 추가합니다.
2. index.js에서 Express 앱을 생성하고 API 라우터를 설정합니다.
3. /routes 폴더에 API 관련 파일을 두어 엔드포인트를 분리합니다.
4. /config 폴더에 Redis 연결 설정 파일을 두어 캐싱 기능을 구현합니다.
5. /jobs 폴더에 node-cron을 이용한 스케줄러를 추가하여 오전 5시 주기로 DB 데이터를 가져와 Redis에 캐싱하도록 합니다.

DB를 임시적으로 조회하는 명령어

```bash
node scripts/printDates.js
```

백엔드 서버 기능은 아직 제작중입니다
