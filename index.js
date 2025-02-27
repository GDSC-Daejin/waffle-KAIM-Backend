require("./config/mongo"); // DB 연결 추가

const express = require("express");
const apiRouter = require("./routes/api");
const dashboardApi = require("./routes/dashboardApi");
const detailApi = require("./routes/detailApi");
const cronJob = require("./jobs/updateCache");

const app = express();
const PORT = process.env.PORT || 8000;

// ...미들웨어 설정 등...
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
