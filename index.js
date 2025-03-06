require("./config/mongo"); // DB 연결 추가

const express = require("express");
const cors = require("cors"); // CORS 미들웨어 추가
const apiRouter = require("./routes/api");
const dashboardApi = require("./routes/dashboardApi");
const detailApi = require("./routes/detailApi");
const cronJob = require("./jobs/updateCache");

const app = express();
const PORT = process.env.PORT || 8000;

// CORS 설정
const corsOptions = {
  origin: function (origin, callback) {
    // 허용할 도메인 목록
    const allowedOrigins = [
      'http://localhost:3000',     // 로컬 개발 환경
      'https://kaim.youth-dev.com', // 프로덕션 환경
      undefined                    // Postman 등 origin이 없는 요청 허용
    ];
    
    if (!origin || allowedOrigins.indexOf(origin) !== -1) {
      callback(null, true);
    } else {
      callback(new Error('CORS 정책에 의해 차단된 요청'));
    }
  },
  credentials: true, // 쿠키 포함 요청 허용
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
};

app.use(cors(corsOptions));

app.use(express.json());

app.use("/api", apiRouter);
app.use("/dashboard-api", dashboardApi);
app.use("/detail-api", detailApi);

// 기본 라우트 (테스트 용)
app.get("/", (req, res) => {
  res.send("NodeJS 백엔드 서버 동작중");
});

app.listen(PORT, () => {
  console.log(`서버가 ${PORT} 포트에서 동작중입니다.`);
});

// 스케줄러 실행
cronJob.start();
