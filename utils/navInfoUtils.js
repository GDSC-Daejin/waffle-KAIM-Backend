const mongoose = require("mongoose");
const { debugLog, formatDate, getQuarterMiddleDate } = require("./dateUtils");
const {
  getLatestDataDate,
  findMostRecentValidCollection,
  getValueFromCollection,
  checkCollectionExists,
} = require("./dbUtils");

/**
 * 환율 데이터 조회 및 계산
 * @returns {Promise<Array<number>>} [최신환율, 변동폭]
 */
async function getExchangeRateData() {
  debugLog("환율 데이터 조회 시작");

  // 최신 데이터는 어제 데이터
  const latestDate = getLatestDataDate();
  debugLog(`최신 데이터 날짜: ${latestDate.toISOString()}`);

  // 최신 컬렉션 찾기
  let latestResult = await findMostRecentValidCollection(latestDate);

  if (!latestResult) {
    debugLog("유효한 최신 컬렉션을 찾지 못함");
    return [0, 0];
  }

  // 이전 컬렉션 찾기 (최신 날짜보다 더 이전)
  const previousDate = new Date(latestResult.date);
  previousDate.setDate(previousDate.getDate() - 1);
  const previousResult = await findMostRecentValidCollection(previousDate);

  if (!previousResult) {
    debugLog("유효한 이전 컬렉션을 찾지 못함");
    return [
      latestResult.collectionName
        ? await getValueFromCollection(
            latestResult.collectionName,
            "KRW_Rating"
          )
        : 0,
      0,
    ];
  }

  try {
    const latestData = await mongoose.connection.db
      .collection(latestResult.collectionName)
      .findOne({});
    const previousData = await mongoose.connection.db
      .collection(previousResult.collectionName)
      .findOne({});

    if (!latestData || !previousData) {
      debugLog("데이터 조회 실패 (빈 결과)");
      return [0, 0];
    }

    const latestRate = latestData.KRW_Rating;
    const previousRate = previousData.KRW_Rating;
    const diff = latestRate - previousRate;

    debugLog(
      `환율 계산 결과: 최신=${latestRate}, 이전=${previousRate}, 차이=${diff}`
    );
    return [latestRate, diff];
  } catch (error) {
    debugLog(`환율 데이터 조회 오류: ${error.message}`);
    return [0, 0];
  }
}

/**
 * 국제유가 데이터 조회 및 계산
 * @returns {Promise<Array<number>>} [최신유가평균, 변동폭]
 */
async function getOilPriceData() {
  debugLog("국제유가 데이터 조회 시작");

  // 최신 데이터는 어제 데이터
  const latestDate = getLatestDataDate();
  debugLog(`최신 데이터 날짜: ${latestDate.toISOString()}`);

  // 최신 컬렉션 찾기
  let latestResult = await findMostRecentValidCollection(latestDate);
  if (!latestResult) {
    debugLog("유효한 최신 컬렉션을 찾지 못함");
    return [0, 0];
  }

  // 이전 컬렉션 찾기
  const previousDate = new Date(latestResult.date);
  previousDate.setDate(previousDate.getDate() - 1);
  const previousResult = await findMostRecentValidCollection(previousDate);
  if (!previousResult) {
    debugLog("유효한 이전 컬렉션을 찾지 못함");
    return [0, 0];
  }

  try {
    const latestData = await mongoose.connection.db
      .collection(latestResult.collectionName)
      .findOne({});
    const previousData = await mongoose.connection.db
      .collection(previousResult.collectionName)
      .findOne({});

    if (!latestData || !previousData) {
      debugLog("국제유가 데이터 조회 실패 (빈 결과)");
      return [0, 0];
    }

    const latestAvg =
      (latestData.Dubai_Val + latestData.Brent_Val + latestData.WTI_Val) / 3;
    const previousAvg =
      (previousData.Dubai_Val + previousData.Brent_Val + previousData.WTI_Val) /
      3;
    const diff = latestAvg - previousAvg;

    debugLog(
      `국제유가 평균: 최신=${latestAvg.toFixed(2)}, 이전=${previousAvg.toFixed(
        2
      )}, 차이=${diff.toFixed(2)}`
    );
    return [parseFloat(latestAvg.toFixed(2)), parseFloat(diff.toFixed(2))];
  } catch (error) {
    debugLog(`국제유가 데이터 조회 오류: ${error.message}`);
    return [0, 0];
  }
}

/**
 * 금리 데이터 조회 및 계산
 * @returns {Promise<Array<number>>} [현재금리, 변동폭]
 */
async function getInterestRateData() {
  debugLog("금리 데이터 조회 시작");

  const redisClient = require("../config/redis");
  const cacheKey = "interest_rate_data";

  // Redis에서 캐시된 데이터 먼저 확인
  if (process.env.ENABLE_REDIS === "1") {
    const cachedData = await redisClient.get(cacheKey);
    if (cachedData) {
      debugLog("Redis 캐시에서 금리 데이터 조회 성공");
      return JSON.parse(cachedData);
    }
  }

  // 최신 데이터는 어제 데이터
  const latestDate = getLatestDataDate();
  debugLog(`최신 데이터 날짜: ${latestDate.toISOString()}`);

  // 최신 컬렉션 찾기
  const latestResult = await findMostRecentValidCollection(latestDate);
  if (!latestResult) {
    debugLog("유효한 금리 데이터를 찾지 못함");
    return [0, 0];
  }

  try {
    // 최신 금리 조회
    const latestData = await mongoose.connection.db
      .collection(latestResult.collectionName)
      .findOne({});

    if (!latestData) {
      debugLog("금리 데이터 없음");
      return [0, 0];
    }

    const currentRate = latestData.interest_rate;
    debugLog(`현재 금리: ${currentRate}`);

    // 이전 다른 금리를 찾을 때까지 과거 데이터 조회
    let previousRate = currentRate;
    let dayDiff = 1;
    let prevDate = new Date(latestResult.date);

    while (previousRate === currentRate && dayDiff < 365) {
      prevDate.setDate(prevDate.getDate() - 1);
      const pastCollection = formatDate(prevDate);

      // 수정: exists() 대신 checkCollectionExists 함수 사용
      if (await checkCollectionExists(pastCollection)) {
        try {
          const pastData = await mongoose.connection.db
            .collection(pastCollection)
            .findOne({});

          if (pastData && pastData.interest_rate !== undefined) {
            debugLog(
              `컬렉션 ${pastCollection}의 금리: ${pastData.interest_rate}`
            );

            if (pastData.interest_rate !== currentRate) {
              previousRate = pastData.interest_rate;
              debugLog(`다른 금리 발견: ${previousRate}`);
              break;
            }
          }
        } catch (err) {
          debugLog(`컬렉션 조회 실패: ${err.message}`);
        }
      }
      dayDiff++;
    }

    const diff = currentRate - previousRate;
    const result = [currentRate, diff];

    debugLog(
      `최종 금리 결과: 현재=${currentRate}, 이전=${previousRate}, 차이=${diff}`
    );

    // 결과 Redis에 저장
    if (process.env.ENABLE_REDIS === "1") {
      await redisClient.set(cacheKey, JSON.stringify(result), { EX: 86400 }); // 24시간 유효
      debugLog("금리 데이터를 Redis에 저장 완료");
    }

    return result;
  } catch (error) {
    debugLog(`금리 데이터 조회 오류: ${error.stack}`);
    return [0, 0];
  }
}

/**
 * 분기에 해당하는 날짜 범위에서 유효한 컬렉션 찾기
 * @param {Date} quarterDate - 분기 중간 날짜
 * @returns {Promise<Object|null>} 컬렉션 정보 또는 null
 */
async function findValidCollectionForQuarter(quarterDate) {
  debugLog(`분기 데이터 컬렉션 검색 시작: 기준일 ${quarterDate.toISOString()}`);

  // 기준일 앞뒤로 최대 45일까지 검색 (한 분기 내에서 찾기 위함)
  const maxDaysToSearch = 45;

  // 먼저 기준일 자체 확인
  const exactCollection = formatDate(quarterDate);

  // 수정: exists() 대신 checkCollectionExists 함수 사용
  if (await checkCollectionExists(exactCollection)) {
    const doc = await mongoose.connection.db
      .collection(exactCollection)
      .findOne({});
    if (doc && doc.gdp !== undefined) {
      debugLog(
        `정확한 분기 중간일 컬렉션 발견: ${exactCollection}, GDP: ${doc.gdp}`
      );
      return { collectionName: exactCollection, data: doc };
    }
  }

  // 기준일 앞뒤로 검색
  for (let i = 1; i <= maxDaysToSearch; i++) {
    // 기준일 이후 검색
    const futureDate = new Date(quarterDate);
    futureDate.setDate(futureDate.getDate() + i);
    const futureCollection = formatDate(futureDate);

    // 수정: exists() 대신 checkCollectionExists 함수 사용
    if (await checkCollectionExists(futureCollection)) {
      const doc = await mongoose.connection.db
        .collection(futureCollection)
        .findOne({});
      if (doc && doc.gdp !== undefined) {
        debugLog(
          `미래 방향에서 컬렉션 발견: ${futureCollection}, GDP: ${doc.gdp}`
        );
        return { collectionName: futureCollection, data: doc };
      }
    }

    // 기준일 이전 검색
    const pastDate = new Date(quarterDate);
    pastDate.setDate(pastDate.getDate() - i);
    const pastCollection = formatDate(pastDate);

    // 수정: exists() 대신 checkCollectionExists 함수 사용
    if (await checkCollectionExists(pastCollection)) {
      const doc = await mongoose.connection.db
        .collection(pastCollection)
        .findOne({});
      if (doc && doc.gdp !== undefined) {
        debugLog(
          `과거 방향에서 컬렉션 발견: ${pastCollection}, GDP: ${doc.gdp}`
        );
        return { collectionName: pastCollection, data: doc };
      }
    }
  }

  debugLog(`유효한 분기 컬렉션을 찾지 못함: ${quarterDate.toISOString()}`);
  return null;
}

/**
 * GDP 데이터 조회 및 계산
 * @returns {Promise<Array<number>>} [현재GDP, 변동률%]
 */
async function getGdpData() {
  debugLog("GDP 데이터 조회 시작");

  // 최신 데이터는 어제 데이터
  const latestDate = getLatestDataDate();
  debugLog(`최신 데이터 날짜: ${latestDate.toISOString()}`);

  // 최신 컬렉션 찾기
  const latestResult = await findMostRecentValidCollection(latestDate);
  if (!latestResult) {
    debugLog("유효한 GDP 데이터를 찾지 못함");
    return [0, 0];
  }

  try {
    // 현재 GDP 조회
    const currentData = await mongoose.connection.db
      .collection(latestResult.collectionName)
      .findOne({});

    if (!currentData) {
      debugLog("GDP 데이터 없음");
      return [0, 0];
    }

    // gdpQuarter가 없으면 gdp 값만 반환
    if (!currentData.gdpQuarter) {
      debugLog("현재 데이터에 분기 정보 없음, GDP만 반환");
      return [currentData.gdp || 0, 0];
    }

    const currentGdp = currentData.gdp;
    const currentQuarter = currentData.gdpQuarter;

    // 중요: 문자열로 변환하여 substring 처리
    const currentQuarterStr = String(currentQuarter);

    // 이전 분기 찾기
    const previousQuarterYear = parseInt(currentQuarterStr.substring(0, 4));
    const previousQuarterNum = parseInt(currentQuarterStr.substring(4, 6));

    let previousQuarter;
    if (previousQuarterNum === 1) {
      previousQuarter = `${previousQuarterYear - 1}04`;
    } else {
      previousQuarter = `${previousQuarterYear}${String(
        previousQuarterNum - 1
      ).padStart(2, "0")}`;
    }

    // 이전 분기 중간 날짜 계산
    const prevQuarterDate = getQuarterMiddleDate(previousQuarter);

    // 이전 분기에 해당하는 유효한 컬렉션 찾기
    const prevQuarterResult = await findValidCollectionForQuarter(
      prevQuarterDate
    );

    if (!prevQuarterResult) {
      debugLog("이전 분기 데이터를 찾지 못함, 현재 GDP만 반환");
      return [currentGdp, 0];
    }

    const previousData = prevQuarterResult.data;

    // GDP 변화율 계산
    if (!previousData.gdp) {
      debugLog("이전 분기 GDP 값이 없음");
      return [currentGdp, 0];
    }

    const previousGdp = previousData.gdp;

    // 퍼센트 변화율 계산
    const percentChange = ((currentGdp - previousGdp) / previousGdp) * 100;

    return [currentGdp, parseFloat(percentChange.toFixed(2))];
  } catch (error) {
    debugLog(`GDP 데이터 조회 오류: ${error.stack}`);
    return [0, 0];
  }
}

/**
 * nav-info API를 위한 모든 데이터 조회
 * @returns {Promise<Object>} 네비게이션 정보 데이터 객체
 */
async function getNavInfoData() {
  // 병렬로 모든 데이터 조회
  const [exchangeRate, oilPrice, interestRate, gdp] = await Promise.all([
    getExchangeRateData(),
    getOilPriceData(),
    getInterestRateData(),
    getGdpData(),
  ]);

  return {
    exchangeRate,
    oilPrice,
    interestRate,
    gdp,
  };
}

module.exports = {
  getExchangeRateData,
  getOilPriceData,
  getInterestRateData,
  getGdpData,
  getNavInfoData,
};
