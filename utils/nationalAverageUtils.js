const mongoose = require("mongoose");
const { debugLog } = require("./dateUtils");
const {
  getLatestDataDate,
  findMostRecentValidCollection,
} = require("./dbUtils");

/**
 * 최근 7일과 이전 7일의 전국 평균 유가 비교 및 최신 유종별 가격 조회
 * @returns {Promise<Array>} [평균유가차이, 최신유종별가격]
 */
async function getNationalAverageData() {
  debugLog("national-average 데이터 조회 시작");

  try {
    // 최신 날짜(어제) 기준
    const latestDate = getLatestDataDate();
    debugLog(`최신 데이터 날짜: ${latestDate.toISOString()}`);

    // 최신 컬렉션 찾기
    const latestResult = await findMostRecentValidCollection(latestDate);
    if (!latestResult) {
      debugLog("최신 데이터를 찾지 못함");
      return [[0], [0, 0, 0, 0]];
    }

    // 최신 도큐먼트 조회 (오늘의 값)
    const latestDoc = await mongoose.connection.db
      .collection(latestResult.collectionName)
      .findOne();

    if (!latestDoc || !latestDoc.area) {
      debugLog("최신 도큐먼트 데이터가 없음");
      return [[0], [0, 0, 0, 0]];
    }

    // 오늘의 전국 유가 데이터 (두 번째 배열)
    const nationalIndex = latestDoc.area.indexOf("National");
    let todayPrices = [0, 0, 0, 0];

    if (nationalIndex !== -1) {
      // [경유, 휘발유, 고급휘발유, 등유] 순서로 저장
      todayPrices = [
        parseFloat(latestDoc.diesel[nationalIndex] || 0),
        parseFloat(latestDoc.gasoline[nationalIndex] || 0),
        parseFloat(latestDoc.premiumGasoline[nationalIndex] || 0),
        parseFloat(latestDoc.kerosene[nationalIndex] || 0),
      ];
      debugLog(
        `오늘의 전국 유가: 경유=${todayPrices[0]}, 휘발유=${todayPrices[1]}, 고급휘발유=${todayPrices[2]}, 등유=${todayPrices[3]}`
      );
    } else {
      debugLog("전국 데이터를 찾지 못함");
    }

    // 14일간의 데이터 조회 (최근 7일 + 이전 7일)
    const recentWeekData = [];
    const previousWeekData = [];

    // 최근 7일 데이터 수집
    for (let i = 0; i < 7; i++) {
      const targetDate = new Date(latestResult.date);
      targetDate.setDate(targetDate.getDate() - i);

      const result = await findMostRecentValidCollection(targetDate);
      if (!result) continue;

      const doc = await mongoose.connection.db
        .collection(result.collectionName)
        .findOne();
      if (!doc || !doc.area) continue;

      const idx = doc.area.indexOf("National");
      if (idx !== -1) {
        // 3종 유가 평균 (등유 제외) - 문자열을 숫자로 변환
        const avgPrice =
          (parseFloat(doc.diesel[idx] || 0) +
            parseFloat(doc.gasoline[idx] || 0) +
            parseFloat(doc.premiumGasoline[idx] || 0)) /
          3;

        recentWeekData.push(avgPrice);
        debugLog(`${i}일 전 전국 3종 평균 유가: ${avgPrice.toFixed(2)}`);
      }
    }

    // 이전 7일 데이터 수집 (최근 7일 이후 7일)
    for (let i = 7; i < 14; i++) {
      const targetDate = new Date(latestResult.date);
      targetDate.setDate(targetDate.getDate() - i);

      const result = await findMostRecentValidCollection(targetDate);
      if (!result) continue;

      const doc = await mongoose.connection.db
        .collection(result.collectionName)
        .findOne();
      if (!doc || !doc.area) continue;

      const idx = doc.area.indexOf("National");
      if (idx !== -1) {
        // 3종 유가 평균 (등유 제외)
        const avgPrice =
          (parseFloat(doc.diesel[idx] || 0) +
            parseFloat(doc.gasoline[idx] || 0) +
            parseFloat(doc.premiumGasoline[idx] || 0)) /
          3;

        previousWeekData.push(avgPrice);
        debugLog(`${i}일 전 전국 3종 평균 유가: ${avgPrice.toFixed(2)}`);
      }
    }

    // 평균 계산
    let recentAvg = 0;
    let previousAvg = 0;

    if (recentWeekData.length > 0) {
      recentAvg =
        recentWeekData.reduce((sum, price) => sum + price, 0) /
        recentWeekData.length;
    }

    if (previousWeekData.length > 0) {
      previousAvg =
        previousWeekData.reduce((sum, price) => sum + price, 0) /
        previousWeekData.length;
    }

    // 차이 계산 (최근 7일 - 이전 7일)
    const difference = parseFloat((recentAvg - previousAvg).toFixed(2));

    debugLog(
      `최근 7일 평균: ${recentAvg.toFixed(
        2
      )}, 이전 7일 평균: ${previousAvg.toFixed(2)}, 차이: ${difference}`
    );
    debugLog("national-average 데이터 조회 완료");

    return [[difference], todayPrices];
  } catch (error) {
    debugLog(`national-average 데이터 조회 오류: ${error.stack}`);
    return [[0], [0, 0, 0, 0]];
  }
}

module.exports = {
  getNationalAverageData,
};
