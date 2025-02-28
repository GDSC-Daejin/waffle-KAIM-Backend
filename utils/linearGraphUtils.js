const mongoose = require("mongoose");
const { debugLog } = require("./dateUtils");
const {
  getLatestDataDate,
  findMostRecentValidCollection,
} = require("./dbUtils");

/**
 * 지난 7일 간의 유가 데이터를 조회하여 선형 그래프용 데이터 생성
 * @returns {Promise<Object>} 선형 그래프 데이터
 */
async function getLinearGraphData() {
  debugLog("linear-graph 데이터 조회 시작");
 
  try {
    // 최신 날짜(어제) 기준
    const latestDate = getLatestDataDate();
    debugLog(`최신 데이터 날짜: ${latestDate.toISOString()}`);

    // 7일간의 데이터 조회
    const days = 7;
    const labels = [];
    const dubaiValues = [];
    const brentValues = [];
    const wtiValues = [];

    for (let i = 0; i < days; i++) {
      const targetDate = new Date(latestDate);
      targetDate.setDate(targetDate.getDate() - i); // i일 전

      const result = await findMostRecentValidCollection(targetDate);
      if (!result) continue;

      debugLog(`${i}일 전 데이터 조회: ${result.collectionName}`);

      const data = await mongoose.connection.db
        .collection(result.collectionName)
        .findOne({});

      if (!data) continue;

      // 날짜 포맷 (MM/DD)
      const month = targetDate.getMonth() + 1;
      const day = targetDate.getDate();
      const dateLabel = `${month}/${day}`;

      labels.unshift(dateLabel); // 오래된 날짜가 먼저 오도록 배열 앞에 추가
      dubaiValues.unshift(data.Dubai_Val || 0);
      brentValues.unshift(data.Brent_Val || 0);
      wtiValues.unshift(data.WTI_Val || 0);

      if (labels.length >= days) break;
    }

    debugLog(`선형 그래프 데이터 조회 완료: ${labels.length}일 데이터`);

    return {
      labels,
      datasets: [
        {
          label: "Dubai",
          data: dubaiValues,
          borderColor: "rgba(255, 99, 132, 1)",
        },
        {
          label: "Brent",
          data: brentValues,
          borderColor: "rgba(54, 162, 235, 1)",
        },
        {
          label: "WTI",
          data: wtiValues,
          borderColor: "rgba(255, 206, 86, 1)",
        },
      ],
    };
  } catch (error) {
    debugLog(`선형 그래프 데이터 조회 오류: ${error.stack}`);
    // 에러 발생 시 기본 데이터 반환
    return {
      labels: [],
      datasets: [
        { label: "Dubai", data: [], borderColor: "rgba(255, 99, 132, 1)" },
        { label: "Brent", data: [], borderColor: "rgba(54, 162, 235, 1)" },
        { label: "WTI", data: [], borderColor: "rgba(255, 206, 86, 1)" },
      ],
    };
  }
}

module.exports = {
  getLinearGraphData,
};
