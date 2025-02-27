const express = require("express");
const router = express.Router();

// 간단한 API 예시: Redis에서 캐싱된 데이터 조회
router.get("/data", async (req, res) => {
  try {
    const redisClient = require("../config/redis");
    const cachedData = await redisClient.get("cachedData");
    if (cachedData) {
      return res.json({ source: "cache", data: JSON.parse(cachedData) });
    }
    // 캐시가 없으면 "DB에서 가져온" 임시 데이터를 반환
    const data = { message: "DB에서 가져온 데이터 (임시)" };
    return res.json({ source: "db", data });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "서버 에러" });
  }
});

module.exports = router;
