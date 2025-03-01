const mongoose = require("mongoose");
const { debugLog, parseNumberArray, roundToTwoDecimals, getKoreanNow } = require("./dateUtils");
const {
  getLatestDataDate,
  findMostRecentValidCollection,
  ensureMongoConnection,
  getPredictDbConnection,
  findLatestPredictCollection,
} = require("./dbUtils");

/**
 * 과거 7일 데이터 조회
 * @returns {Promise<Array<Object>>} 과거 7일 데이터
 */
async function fetchHistoricalData() {
  debugLog("과거 7일 데이터 조회 시작");
  
  // MongoDB 연결 확인
  await ensureMongoConnection();
  
  // 최신 날짜(어제) 기준
  const latestDate = getLatestDataDate();
  debugLog(`최신 데이터 날짜: ${latestDate.toISOString()}`);
  
  const days = 7;
  const historyData = [];
  
  for (let i = 0; i < days; i++) {
    const targetDate = new Date(latestDate);
    targetDate.setDate(targetDate.getDate() - i); // i일 전
    
    const result = await findMostRecentValidCollection(targetDate);
    if (!result) {
      debugLog(`${i}일 전 데이터 조회 실패: 컬렉션 없음`);
      continue;
    }
    
    debugLog(`${i}일 전 데이터 조회: ${result.collectionName}`);
    
    try {
      const data = await mongoose.connection.db
        .collection(result.collectionName)
        .findOne({});
      
      if (!data) {
        debugLog(`${i}일 전 데이터 없음`);
        continue;
      }
      
      // 데이터 파싱 (첫 번째 요소 = 전국 평균)
      const dayData = {
        date: targetDate,
        diesel: data.diesel && data.diesel[0] ? roundToTwoDecimals(parseFloat(data.diesel[0])) : 0,
        gasoline: data.gasoline && data.gasoline[0] ? roundToTwoDecimals(parseFloat(data.gasoline[0])) : 0,
        premiumGasoline: data.premiumGasoline && data.premiumGasoline[0] ? roundToTwoDecimals(parseFloat(data.premiumGasoline[0])) : 0,
        kerosene: data.kerosene && data.kerosene[0] ? roundToTwoDecimals(parseFloat(data.kerosene[0])) : 0,
      };
      
      historyData.push(dayData);
      
      debugLog(`${i}일 전 데이터 조회 성공: ${JSON.stringify(dayData)}`);
    } catch (error) {
      debugLog(`${i}일 전 데이터 조회 오류: ${error.message}`);
    }
  }
  
  // 날짜 오름차순 정렬 (가장 오래된 데이터가 먼저)
  return historyData.sort((a, b) => a.date - b.date);
}

/**
 * 예측 3일 데이터 조회
 * @returns {Promise<Array<Object>>} 예측 3일 데이터
 */
async function fetchPredictionData() {
  debugLog("예측 3일 데이터 조회 시작");
  
  try {
    // 예측 DB 연결 및 최신 예측 컬렉션 찾기
    const connection = await getPredictDbConnection();
    if (!connection || !connection.db) {
      debugLog("유효한 예측 DB 연결이 없습니다");
      return [];
    }
    
    const latestPredictCollection = await findLatestPredictCollection();
    if (!latestPredictCollection) {
      debugLog("유효한 예측 컬렉션을 찾지 못함");
      return [];
    }
    
    debugLog(`예측 컬렉션 조회: ${latestPredictCollection}`);
    
    // 컬렉션에서 데이터 조회
    const predictData = await connection.db.collection(latestPredictCollection).findOne({});
    if (!predictData) {
      debugLog("예측 데이터 없음");
      return [];
    }
    
    debugLog(`예측 데이터 조회 성공: ${JSON.stringify(predictData._id)}`);
    
    // 데이터 필드 검사
    const keys = Object.keys(predictData).filter(k => k.startsWith('p'));
    if (keys.length === 0) {
      debugLog("예측 데이터에 p0, p1, p2 형식의 필드가 없음");
    } else {
      debugLog(`발견된 예측 필드: ${keys.join(', ')}`);
    }
    
    // 예측 데이터 파싱 (p0, p1, p2)
    const predictionDays = [];
    
    // 오늘 날짜를 기준으로 계산
    const today = getKoreanNow();
    debugLog(`예측 데이터 기준 날짜(오늘): ${today.toISOString()}`);
    
    for (let i = 0; i < 3; i++) {
      const key = `p${i}`;
      const predictDay = predictData[key];
      
      if (!predictDay) {
        debugLog(`${key} 예측 데이터 없음`);
        continue;
      }
      
      // 예측일 계산 (오늘부터 시작해서 +i일)
      const predictDate = new Date(today);
      predictDate.setDate(predictDate.getDate() + i); // p0는 오늘, p1은 내일, p2는 모레
      
      try {
        const dayData = {
          date: predictDate,
          diesel: predictDay.diesel && predictDay.diesel[0] ? roundToTwoDecimals(parseFloat(predictDay.diesel[0])) : 0,
          gasoline: predictDay.gasoline && predictDay.gasoline[0] ? roundToTwoDecimals(parseFloat(predictDay.gasoline[0])) : 0,
          premiumGasoline: predictDay.premiumGasoline && predictDay.premiumGasoline[0] ? roundToTwoDecimals(parseFloat(predictDay.premiumGasoline[0])) : 0,
          kerosene: predictDay.kerosene && predictDay.kerosene[0] ? roundToTwoDecimals(parseFloat(predictDay.kerosene[0])) : 0,
        };
        
        predictionDays.push(dayData);
        debugLog(`예측 데이터 ${key} 파싱 완료: ${JSON.stringify({
          날짜: predictDate.toLocaleDateString('ko-KR'),
          diesel: dayData.diesel,
          gasoline: dayData.gasoline,
          premiumGasoline: dayData.premiumGasoline,
          kerosene: dayData.kerosene
        })}`);
      } catch (err) {
        debugLog(`예측 데이터 파싱 오류 (${key}): ${err.message}`);
        // 오류 발생 시 구조 출력
        if (predictDay) {
          debugLog(`${key} 구조: ${Object.keys(predictDay).join(', ')}`);
        }
      }
    }
    
    return predictionDays;
  } catch (error) {
    debugLog(`예측 데이터 조회 오류: ${error.stack}`);
    return [];
  }
}

/**
 * 과거 7일과 예측 3일 데이터를 조합하여 선형 그래프용 데이터 생성
 * @returns {Promise<Object>} 조합된 선형 그래프 데이터
 */
async function getLinearGraphData() {
  debugLog("linear-graph 데이터 조회 시작");
 
  try {
    // 과거 데이터와 예측 데이터 병렬로 조회
    const [historicalData, predictionData] = await Promise.all([
      fetchHistoricalData(),
      fetchPredictionData(),
    ]);
    
    debugLog(`과거 데이터 ${historicalData.length}개, 예측 데이터 ${predictionData.length}개 조회 완료`);
    
    // 과거 7일 데이터 포맷팅 (h6~h0)
    const historyResults = {};
    historicalData.forEach((data, index) => {
      const key = `h${6 - index}`; // h6(가장 과거) ~ h0(가장 최근)
      historyResults[key] = {
        diesel: data.diesel,
        gasoline: data.gasoline,
        premiumGasoline: data.premiumGasoline,
        kerosene: data.kerosene,
      };
      
      debugLog(`${key} 데이터 설정 완료`);
    });
    
    // 예측 3일 데이터 포맷팅 (pre0~pre2)
    predictionData.forEach((data, index) => {
      const key = `pre${index}`; // pre0(오늘 예측) ~ pre2(모레 예측)
      historyResults[key] = {
        diesel: data.diesel,
        gasoline: data.gasoline,
        premiumGasoline: data.premiumGasoline,
        kerosene: data.kerosene,
      };
      
      debugLog(`${key} 데이터 설정 완료`);
    });
    
    debugLog("선형 그래프 데이터 조회 완료");
    return historyResults;
    
  } catch (error) {
    debugLog(`선형 그래프 데이터 조회 오류: ${error.stack}`);
    // 에러 발생 시 기본 빈 데이터 반환
    return {
      h6: {}, h5: {}, h4: {}, h3: {}, h2: {}, h1: {}, h0: {},
      pre0: {}, pre1: {}, pre2: {}
    };
  }
}

module.exports = {
  getLinearGraphData,
  fetchHistoricalData,
  fetchPredictionData,
};
