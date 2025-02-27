const mongoose = require("mongoose");
const { debugLog } = require("./dateUtils");
const {
  getLatestDataDate,
  findMostRecentValidCollection,
} = require("./dbUtils");

// 영문 지역명 순서 (전국 제외)
const regionOrder = [
  "Seoul",
  "Busan",
  "Daegu",
  "Incheon",
  "Gwangju",
  "Daejeon",
  "Ulsan",
  "Sejong",
  "Gyeonggi",
  "Gangwon",
  "Chungbuk",
  "Chungnam",
  "Jeonbuk",
  "Jeonnam",
  "Gyeongbuk",
  "Gyeongnam",
];

// 영문 지역명을 한글 지역명으로 매핑 (디버그 로그용)
const koreanNames = {
  Seoul: "서울",
  Busan: "부산",
  Daegu: "대구",
  Incheon: "인천",
  Gwangju: "광주",
  Daejeon: "대전",
  Ulsan: "울산",
  Sejong: "세종",
  Gyeonggi: "경기",
  Gangwon: "강원",
  Chungbuk: "충북",
  Chungnam: "충남",
  Jeonbuk: "전북",
  Jeonnam: "전남",
  Gyeongbuk: "경북",
  Gyeongnam: "경남",
};

/**
 * 각 지역별 오늘/어제 유가 비교 데이터 조회
 * @returns {Promise<Array>} 지역별 유가 비교 데이터
 */
async function getComparisonData() {
  debugLog("comparison 데이터 조회 시작");

  try {
    // 최신 날짜(어제) 기준
    const latestDate = getLatestDataDate();
    debugLog(`최신 데이터 날짜: ${latestDate.toISOString()}`);

    // 오늘(최신) 데이터 조회
    const todayResult = await findMostRecentValidCollection(latestDate);
    if (!todayResult) {
      debugLog("오늘 데이터를 찾지 못함");
      return getEmptyComparisonData();
    }

    // 어제 날짜 계산 (오늘 기준 하루 전)
    const yesterdayDate = new Date(todayResult.date);
    yesterdayDate.setDate(yesterdayDate.getDate() - 1);

    // 어제 데이터 조회
    const yesterdayResult = await findMostRecentValidCollection(yesterdayDate);
    if (!yesterdayResult) {
      debugLog("어제 데이터를 찾지 못함");
      return getEmptyComparisonData();
    }

    // 오늘 도큐먼트 조회
    const todayDoc = await mongoose.connection.db
      .collection(todayResult.collectionName)
      .findOne();

    // 어제 도큐먼트 조회
    const yesterdayDoc = await mongoose.connection.db
      .collection(yesterdayResult.collectionName)
      .findOne();

    if (!todayDoc || !todayDoc.area || !yesterdayDoc || !yesterdayDoc.area) {
      debugLog("유효한 데이터를 찾지 못함");
      return getEmptyComparisonData();
    }

    debugLog("오늘/어제 데이터 조회 성공");

    // 결과 배열 초기화 (16개 지역)
    const result = [];

    // 각 지역별로 데이터 추출
    regionOrder.forEach((region) => {
      // 오늘 데이터에서 해당 지역 인덱스 찾기
      const todayIndex = todayDoc.area.findIndex((area) => area === region);
      const yesterdayIndex = yesterdayDoc.area.findIndex(
        (area) => area === region
      );

      // 지역 데이터 객체 생성
      let regionData = {
        diesel: [0, 0],
        gasoline: [0, 0],
        premiumGasoline: [0, 0],
        kerosene: [0, 0],
      };

      if (todayIndex !== -1 && yesterdayIndex !== -1) {
        // 경유 가격 및 차이
        const todayDiesel = parseFloat(todayDoc.diesel[todayIndex] || 0);
        const yesterdayDiesel = parseFloat(
          yesterdayDoc.diesel[yesterdayIndex] || 0
        );
        const dieselDiff = parseFloat(
          (todayDiesel - yesterdayDiesel).toFixed(2)
        );

        // 휘발유 가격 및 차이
        const todayGasoline = parseFloat(todayDoc.gasoline[todayIndex] || 0);
        const yesterdayGasoline = parseFloat(
          yesterdayDoc.gasoline[yesterdayIndex] || 0
        );
        const gasolineDiff = parseFloat(
          (todayGasoline - yesterdayGasoline).toFixed(2)
        );

        // 고급휘발유 가격 및 차이
        const todayPremium = parseFloat(
          todayDoc.premiumGasoline[todayIndex] || 0
        );
        const yesterdayPremium = parseFloat(
          yesterdayDoc.premiumGasoline[yesterdayIndex] || 0
        );
        const premiumDiff = parseFloat(
          (todayPremium - yesterdayPremium).toFixed(2)
        );

        // 등유 가격 및 차이
        const todayKerosene = parseFloat(todayDoc.kerosene[todayIndex] || 0);
        const yesterdayKerosene = parseFloat(
          yesterdayDoc.kerosene[yesterdayIndex] || 0
        );
        const keroseneDiff = parseFloat(
          (todayKerosene - yesterdayKerosene).toFixed(2)
        );

        // 결과 객체 업데이트
        regionData = {
          diesel: [todayDiesel, dieselDiff],
          gasoline: [todayGasoline, gasolineDiff],
          premiumGasoline: [todayPremium, premiumDiff],
          kerosene: [todayKerosene, keroseneDiff],
        };

        debugLog(`${koreanNames[region]} 지역 데이터 처리 완료: 
          경유: ${todayDiesel} (${dieselDiff}),
          휘발유: ${todayGasoline} (${gasolineDiff}),
          고급휘발유: ${todayPremium} (${premiumDiff}),
          등유: ${todayKerosene} (${keroseneDiff})`);
      } else {
        debugLog(
          `${region} 지역 데이터 없음 (오늘: ${todayIndex}, 어제: ${yesterdayIndex})`
        );
      }

      result.push(regionData);
    });

    debugLog("comparison 데이터 조회 완료");
    return result;
  } catch (error) {
    debugLog(`comparison 데이터 조회 오류: ${error.stack}`);
    return getEmptyComparisonData();
  }
}

/**
 * 빈 comparison 데이터 반환
 * @returns {Array} 빈 지역별 유가 데이터 배열
 */
function getEmptyComparisonData() {
  // 16개 지역에 대한 빈 데이터 생성
  const emptyData = {
    diesel: [0, 0],
    gasoline: [0, 0],
    premiumGasoline: [0, 0],
    kerosene: [0, 0],
  };

  return Array(16)
    .fill()
    .map(() => ({ ...emptyData }));
}

module.exports = {
  getComparisonData,
  getEmptyComparisonData,
};
