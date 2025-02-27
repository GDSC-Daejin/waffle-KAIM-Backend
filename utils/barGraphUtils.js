const mongoose = require("mongoose");
const { debugLog } = require("./dateUtils");
const {
  getLatestDataDate,
  findMostRecentValidCollection,
} = require("./dbUtils");

// 영문 지역명을 한글 지역명으로 매핑
const regionMapping = {
  National: "전국",
  Seoul: "서울",
  Busan: "부산",
  Gyeonggi: "경기",
  Gangwon: "강원",
  Gyeongnam: "경남",
  Gyeongbuk: "경북",
  Chungnam: "충남",
  Chungbuk: "충북",
};

/**
 * bar-graph API 데이터 조회
 * @returns {Promise<Object>} 각 유종별 지역 가격 데이터
 */
async function getBarGraphData() {
  debugLog("bar-graph 데이터 조회 시작");

  // 최신 데이터는 어제 데이터
  const latestDate = getLatestDataDate();
  debugLog(`최신 데이터 날짜: ${latestDate.toISOString()}`);

  // 최신 컬렉션 찾기
  const latestResult = await findMostRecentValidCollection(latestDate);
  if (!latestResult) {
    debugLog("유효한 컬렉션을 찾지 못함");
    return getEmptyBarGraphData();
  }

  try {
    // 컬렉션에서 도큐먼트 조회
    const doc = await mongoose.connection.db
      .collection(latestResult.collectionName)
      .findOne();

    if (!doc || !doc.area) {
      debugLog("유효한 데이터를 찾지 못함");
      return getEmptyBarGraphData();
    }

    debugLog(`컬렉션 ${latestResult.collectionName}에서 데이터 조회됨`);

    // 필요한 지역 순서 (클라이언트 요구사항)
    const targetRegions = [
      "전국",
      "서울",
      "경기",
      "강원",
      "경남",
      "경북",
      "충남",
      "충북",
      "부산",
    ];

    // 결과 데이터 초기화
    const diesel = new Array(targetRegions.length).fill(0);
    const gasoline = new Array(targetRegions.length).fill(0);
    const premiumGasoline = new Array(targetRegions.length).fill(0);

    // 도큐먼트의 area 배열에서 필요한 지역 인덱스 찾기
    doc.area.forEach((englishName, index) => {
      const koreanName = regionMapping[englishName];

      // 필요한 지역인 경우 해당 인덱스의 데이터 추출
      if (koreanName && targetRegions.includes(koreanName)) {
        const targetIndex = targetRegions.indexOf(koreanName);

        // 문자열을 숫자로 변환
        diesel[targetIndex] = parseFloat(doc.diesel[index] || "0");
        gasoline[targetIndex] = parseFloat(doc.gasoline[index] || "0");
        premiumGasoline[targetIndex] = parseFloat(
          doc.premiumGasoline[index] || "0"
        );

        debugLog(
          `지역 매핑: ${englishName} -> ${koreanName}, 인덱스 ${index} -> ${targetIndex}`
        );
        debugLog(
          `데이터: 경유=${diesel[targetIndex]}, 휘발유=${gasoline[targetIndex]}, 고급휘발유=${premiumGasoline[targetIndex]}`
        );
      }
    });

    // 데이터 누락 지역 확인
    targetRegions.forEach((region, index) => {
      if (
        diesel[index] === 0 &&
        gasoline[index] === 0 &&
        premiumGasoline[index] === 0
      ) {
        debugLog(`경고: ${region} 지역 데이터 없음`);
      }
    });

    debugLog("bar-graph 데이터 조회 완료");
    return {
      diesel,
      gasoline,
      premiumGasoline,
    };
  } catch (error) {
    debugLog(`bar-graph 데이터 조회 오류: ${error.stack}`);
    return getEmptyBarGraphData();
  }
}

/**
 * 빈 bar-graph 데이터 반환
 * @returns {Object} 빈 데이터 객체
 */
function getEmptyBarGraphData() {
  return {
    diesel: [0, 0, 0, 0, 0, 0, 0, 0, 0],
    gasoline: [0, 0, 0, 0, 0, 0, 0, 0, 0],
    premiumGasoline: [0, 0, 0, 0, 0, 0, 0, 0, 0],
  };
}

module.exports = {
  getBarGraphData,
  getEmptyBarGraphData,
};
