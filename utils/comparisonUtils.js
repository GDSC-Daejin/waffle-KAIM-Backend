const mongoose = require("mongoose");
const { debugLog } = require("./dateUtils");
const {
  getLatestDataDate,
  findMostRecentValidCollection,
} = require("./dbUtils");

/**
 * 이번 달과 저번 달의 국내 유가 비교 데이터 생성
 * @returns {Promise<Object>} 비교 데이터
 */
async function getComparisonData() {
  debugLog("comparison 데이터 조회 시작");

  try {
    // 최신 날짜(어제) 기준
    const latestDate = getLatestDataDate();
    const currentMonth = latestDate.getMonth();
    const currentYear = latestDate.getFullYear();

    // 최신 데이터 조회
    const currentResult = await findMostRecentValidCollection(latestDate);
    if (!currentResult) {
      debugLog("현재 데이터를 찾지 못함");
      return getEmptyComparisonData();
    }

    // 1개월 전 날짜 계산
    const lastMonth = new Date(latestDate);
    lastMonth.setMonth(lastMonth.getMonth() - 1);

    // 저번 달 데이터 조회
    const lastMonthResult = await findMostRecentValidCollection(lastMonth);
    if (!lastMonthResult) {
      debugLog("저번 달 데이터를 찾지 못함");
      return getEmptyComparisonData();
    }

    // 현재와 이전 달 데이터 조회
    const currentData = await mongoose.connection.db
      .collection(currentResult.collectionName)
      .find({ area: { $in: ["전국", "서울", "부산"] } })
      .toArray();

    const lastMonthData = await mongoose.connection.db
      .collection(lastMonthResult.collectionName)
      .find({ area: { $in: ["전국", "서울", "부산"] } })
      .toArray();

    // 데이터 정리
    const comparisonData = {
      current: {
        month: `${currentYear}-${String(currentMonth + 1).padStart(2, "0")}`,
        data: {},
      },
      lastMonth: {
        month: `${lastMonth.getFullYear()}-${String(
          lastMonth.getMonth() + 1
        ).padStart(2, "0")}`,
        data: {},
      },
    };

    // 지역별 데이터 정리
    ["전국", "서울", "부산"].forEach((area) => {
      // 현재 달 데이터
      const currentAreaData = currentData.find((d) => d.area === area);
      if (currentAreaData) {
        comparisonData.current.data[area] = {
          gasoline: currentAreaData.gasoline || 0,
          diesel: currentAreaData.diesel || 0,
        };
      }

      // 이전 달 데이터
      const lastMonthAreaData = lastMonthData.find((d) => d.area === area);
      if (lastMonthAreaData) {
        comparisonData.lastMonth.data[area] = {
          gasoline: lastMonthAreaData.gasoline || 0,
          diesel: lastMonthAreaData.diesel || 0,
        };
      }
    });

    debugLog("comparison 데이터 조회 완료");
    return comparisonData;
  } catch (error) {
    debugLog(`comparison 데이터 조회 오류: ${error.stack}`);
    return getEmptyComparisonData();
  }
}

/**
 * 빈 comparison 데이터 반환
 * @returns {Object} 빈 데이터 객체
 */
function getEmptyComparisonData() {
  const now = new Date();
  const lastMonth = new Date();
  lastMonth.setMonth(lastMonth.getMonth() - 1);

  return {
    current: {
      month: `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(
        2,
        "0"
      )}`,
      data: {
        전국: { gasoline: 0, diesel: 0 },
        서울: { gasoline: 0, diesel: 0 },
        부산: { gasoline: 0, diesel: 0 },
      },
    },
    lastMonth: {
      month: `${lastMonth.getFullYear()}-${String(
        lastMonth.getMonth() + 1
      ).padStart(2, "0")}`,
      data: {
        전국: { gasoline: 0, diesel: 0 },
        서울: { gasoline: 0, diesel: 0 },
        부산: { gasoline: 0, diesel: 0 },
      },
    },
  };
}

module.exports = {
  getComparisonData,
  getEmptyComparisonData,
};
