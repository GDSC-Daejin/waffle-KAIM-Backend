const cron = require("node-cron");
const redisClient = require("../config/redis");
const mongoose = require("mongoose");
const { debugLog } = require("../utils/dateUtils");
const { getNavInfoData } = require("../utils/navInfoUtils");
const { getBarGraphData } = require("../utils/barGraphUtils");
const { getLinearGraphData } = require("../utils/linearGraphUtils");
const { getComparisonData } = require("../utils/comparisonUtils");
const { getNationalAverageData } = require("../utils/nationalAverageUtils"); // 추가

/**
 * 대시보드 데이터 수집 함수 - 모든 대시보드 API 데이터 수집
 * @returns {Promise<Object>} 모든 대시보드 API 데이터 객체
 */
async function collectDashboardData() {
  try {
    console.log("대시보드 데이터 수집 시작");

    // 각 API 데이터 병렬 조회 (national-average 추가)
    const [
      navInfoData,
      barGraphData,
      linearGraphData,
      comparisonData,
      nationalAverageData,
    ] = await Promise.all([
      getNavInfoData(),
      getBarGraphData(),
      getLinearGraphData(),
      getComparisonData(),
      getNationalAverageData(),
    ]);

    console.log("대시보드 데이터 수집 완료");

    // 금리 데이터는 별도로 캐싱 (이미 navInfoData 조회 과정에서 Redis에 저장됨)

    return {
      "nav-info": navInfoData,
      "bar-graph": barGraphData,
      "linear-graph": linearGraphData,
      comparison: comparisonData,
      "national-average": nationalAverageData, // 추가
    };
  } catch (error) {
    console.error("데이터 수집 중 오류 발생:", error);
    throw error;
  }
}

/**
 * 스케줄러 작업 - 매일 오전 5시 실행
 */
const task = cron.schedule(
  "0 5 * * *",
  async () => {
    console.log("스케줄러: 대쉬보드 데이터를 Redis에 캐싱합니다.");
    try {
      // 데이터 수집
      const dataForKeys = await collectDashboardData();

      // Redis에 저장
      for (const key in dataForKeys) {
        await redisClient.set(key, JSON.stringify(dataForKeys[key]), {
          EX: 3600, // 1시간 캐싱
        });
      }
      console.log("캐시 업데이트 완료");
    } catch (error) {
      console.error("캐시 업데이트 실패:", error);
    }
  },
  { scheduled: false }
);

module.exports = task;
