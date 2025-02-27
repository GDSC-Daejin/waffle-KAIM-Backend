const cron = require("node-cron");
const redisClient = require("../config/redis");

// 오전 5시마다 DB 데이터를 캐싱하는 작업 (예시)
const task = cron.schedule(
  "0 5 * * *",
  async () => {
    console.log("스케줄러: DB 데이터를 Redis에 캐싱합니다.");
    try {
      // 실제 DB 연결 및 데이터 조회 로직 필요 (여기서는 예시 데이터 사용)
      const dataFromDB = { message: "실제 DB에서 가져온 데이터 (예시)" };
      await redisClient.set("cachedData", JSON.stringify(dataFromDB), {
        EX: 3600, // 1시간 유효
      });
      console.log("캐시 업데이트 완료");
    } catch (error) {
      console.error("캐시 업데이트 실패:", error);
    }
  },
  {
    scheduled: false,
  }
);

module.exports = task;
