const express = require("express");
const router = express.Router();
const mongoose = require("mongoose");
const { debugLog } = require("../utils/dateUtils");

// API 별 처리 유틸리티 불러오기
const { getNavInfoData } = require("../utils/navInfoUtils");
const { getBarGraphData } = require("../utils/barGraphUtils");
const { getLinearGraphData } = require("../utils/linearGraphUtils");
const { getComparisonData } = require("../utils/comparisonUtils");
const { getNationalAverageData } = require("../utils/nationalAverageUtils"); // 추가

/**
 * MongoDB 연결 상태 확인
 * @returns {boolean} 연결 상태 정상 여부
 */
function checkMongoConnection() {
  return mongoose.connection && mongoose.connection.readyState === 1;
}

/**
 * API 요청 처리 공통 함수
 * @param {string} apiName - API 이름
 * @param {Function} dataFetcher - 데이터 조회 함수
 * @returns {Function} 라우터 핸들러 함수
 */
function createApiHandler(apiName, dataFetcher) {
  return async (req, res) => {
    try {
      debugLog(`${apiName} API 요청 시작`);

      // MongoDB 연결 상태 확인
      if (!checkMongoConnection()) {
        debugLog("MongoDB 연결 상태 오류");
        return res.status(500).json({
          error: "DB 연결 실패",
          readyState: mongoose.connection
            ? mongoose.connection.readyState
            : "undefined",
        });
      }

      const redisClient = require("../config/redis");
      const cacheKey = apiName;

      // Redis 캐시 확인 (ENABLE_REDIS가 1인 경우)
      if (process.env.ENABLE_REDIS === "1") {
        debugLog("Redis 캐시 확인 중");
        const cachedData = await redisClient.get(cacheKey);
        if (cachedData) {
          debugLog("Redis 캐시에서 데이터 조회 성공");
          return res.json({ source: "cache", data: JSON.parse(cachedData) });
        }
        debugLog("Redis 캐시에 데이터 없음");
      }

      debugLog("DB에서 데이터 조회 시작");

      // 데이터 조회 및 계산
      const data = await dataFetcher();

      debugLog("응답 데이터:", data);

      // Redis에 캐싱 (ENABLE_REDIS가 1인 경우)
      if (process.env.ENABLE_REDIS === "1") {
        await redisClient.set(cacheKey, JSON.stringify(data), { EX: 3600 }); // 1시간 캐싱
        debugLog("Redis에 데이터 캐싱 완료");
      }

      res.json({ source: "db", data });
    } catch (error) {
      debugLog(`${apiName} API 오류: ${error.stack}`);
      res.status(500).json({ error: "서버 에러", message: error.message });
    }
  };
}

// 대시보드 API 엔드포인트 정의
router.get("/nav-info", createApiHandler("nav-info", getNavInfoData));
router.get("/bar-graph", createApiHandler("bar-graph", getBarGraphData));
router.get(
  "/linear-graph",
  createApiHandler("linear-graph", getLinearGraphData)
);
router.get("/comparison", createApiHandler("comparison", getComparisonData));
router.get(
  "/national-average",
  createApiHandler("national-average", getNationalAverageData)
); // 추가

module.exports = router;
