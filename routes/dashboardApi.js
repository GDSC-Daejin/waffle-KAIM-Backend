const express = require("express");
const router = express.Router();
const mongoose = require("mongoose");

// 날짜 관련 유틸리티 함수
function getKoreanNow() {
  const now = new Date();
  const utc = now.getTime() + now.getTimezoneOffset() * 60000;
  return new Date(utc + 9 * 3600000);
}

// 최신 데이터 날짜 가져오기 (항상 오늘-1일이 최신 데이터)
function getLatestDataDate() {
  const koreanNow = getKoreanNow();
  const latestDate = new Date(koreanNow);
  latestDate.setDate(latestDate.getDate() - 1); // 항상 하루 전 데이터가 최신
  return latestDate;
}

function formatDate(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `Date_${year}_${month}_${day}`;
}

// 디버그 로그 함수
function debugLog(message, data = null) {
  if (process.env.DEBUG_MODE === "1") {
    console.log(`[DEBUG] ${message}`);
    if (data) console.log(JSON.stringify(data, null, 2));
  }
}

// 컬렉션 존재 여부 확인
async function checkCollectionExists(collectionName) {
  try {
    const collections = await mongoose.connection.db
      .listCollections()
      .toArray();
    const exists = collections.some((col) => col.name === collectionName);
    debugLog(`컬렉션 ${collectionName} 존재 여부: ${exists}`);
    return exists;
  } catch (error) {
    debugLog(`컬렉션 확인 오류: ${error.message}`);
    return false;
  }
}

// 지정된 날짜에 데이터가 없으면 가장 최근 유효한 날짜 찾기
async function findMostRecentValidCollection(startDate) {
  const maxDaysBack = 30; // 최대 30일 전까지만 조회
  let currentDate = new Date(startDate);

  for (let i = 0; i < maxDaysBack; i++) {
    const collectionName = formatDate(currentDate);
    debugLog(`유효 컬렉션 탐색: ${collectionName} 확인 중`);

    if (await checkCollectionExists(collectionName)) {
      try {
        const doc = await mongoose.connection.db
          .collection(collectionName)
          .findOne({});
        if (doc) {
          debugLog(`유효 컬렉션 발견: ${collectionName}`);
          return { collectionName, date: new Date(currentDate) };
        }
      } catch (err) {
        debugLog(`컬렉션 조회 실패: ${err.message}`);
      }
    }

    // 하루 전으로 이동
    currentDate.setDate(currentDate.getDate() - 1);
  }

  debugLog(`최근 ${maxDaysBack}일 내 유효 컬렉션을 찾지 못함`);
  return null;
}

// 환율 데이터 계산 함수
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

    debugLog("최신 컬렉션 데이터:", latestData);
    debugLog("이전 컬렉션 데이터:", previousData);

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

// 특정 컬렉션에서 필드값 조회 헬퍼 함수
async function getValueFromCollection(collectionName, fieldName) {
  try {
    const data = await mongoose.connection.db
      .collection(collectionName)
      .findOne({});
    return data && data[fieldName] !== undefined ? data[fieldName] : 0;
  } catch (error) {
    debugLog(`${collectionName}에서 ${fieldName} 조회 오류: ${error.message}`);
    return 0;
  }
}

// 국제유가 데이터는 기존 함수 로직에 로깅만 추가
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

    debugLog("최신 유가 데이터:", {
      Dubai: latestData.Dubai_Val,
      Brent: latestData.Brent_Val,
      WTI: latestData.WTI_Val,
    });

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

// 금리 데이터 계산 및 로깅 추가
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

      debugLog(`이전 금리 검색: ${pastCollection} 확인 중`);

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

// GDP 함수는 기존 로직에 로깅 추가 (기타 함수는 생략)
function getQuarterMiddleDate(yearQuarter) {
  // 확실히 문자열로 변환
  const yearQuarterStr = String(yearQuarter);

  // yearQuarter 형식은 YYYYQQ (예: 202403)
  const year = parseInt(yearQuarterStr.substring(0, 4));
  const quarter = parseInt(yearQuarterStr.substring(4, 6));

  debugLog(`분기 중간 날짜 계산: 년도=${year}, 분기=${quarter}`);

  // 각 분기의 중간 달(2,5,8,11)의 15일을 반환
  const month = (quarter - 1) * 3 + 2;
  return new Date(year, month - 1, 15);
}

// 분기에 해당하는 날짜 범위에서 유효한 컬렉션 찾기
async function findValidCollectionForQuarter(quarterDate) {
  debugLog(`분기 데이터 컬렉션 검색 시작: 기준일 ${quarterDate.toISOString()}`);

  // 기준일 앞뒤로 최대 45일까지 검색 (한 분기 내에서 찾기 위함)
  const maxDaysToSearch = 45;

  // 먼저 기준일 자체 확인
  const exactCollection = formatDate(quarterDate);
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

    debugLog(`미래 방향 검색: ${futureCollection} 확인 중`);
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

    debugLog(`과거 방향 검색: ${pastCollection} 확인 중`);
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

    debugLog(
      `현재 GDP: ${currentGdp}, 분기: ${currentQuarter}, 타입: ${typeof currentQuarter}`
    );

    // 중요: 문자열로 변환하여 substring 처리
    const currentQuarterStr = String(currentQuarter);

    // 이전 분기 찾기
    const previousQuarterYear = parseInt(currentQuarterStr.substring(0, 4));
    const previousQuarterNum = parseInt(currentQuarterStr.substring(4, 6));

    debugLog(
      `분기 구성요소: 년도=${previousQuarterYear}, 분기번호=${previousQuarterNum}`
    );

    let previousQuarter;
    if (previousQuarterNum === 1) {
      previousQuarter = `${previousQuarterYear - 1}04`;
    } else {
      previousQuarter = `${previousQuarterYear}${String(
        previousQuarterNum - 1
      ).padStart(2, "0")}`;
    }

    debugLog(`이전 분기: ${previousQuarter}`);

    // 이전 분기 중간 날짜 계산
    const prevQuarterDate = getQuarterMiddleDate(previousQuarter);
    debugLog(`이전 분기 중간 날짜: ${prevQuarterDate.toISOString()}`);

    // 이전 분기에 해당하는 유효한 컬렉션 찾기
    const prevQuarterResult = await findValidCollectionForQuarter(
      prevQuarterDate
    );

    if (!prevQuarterResult) {
      debugLog("이전 분기 데이터를 찾지 못함, 현재 GDP만 반환");
      return [currentGdp, 0];
    }

    const previousData = prevQuarterResult.data;
    debugLog(
      `이전 분기 데이터 (${prevQuarterResult.collectionName}):`,
      previousData
    );

    // GDP 변화율 계산
    if (!previousData.gdp) {
      debugLog("이전 분기 GDP 값이 없음");
      return [currentGdp, 0];
    }

    const previousGdp = previousData.gdp;
    debugLog(`이전 GDP: ${previousGdp}`);

    // 퍼센트 변화율 계산
    const percentChange = ((currentGdp - previousGdp) / previousGdp) * 100;
    debugLog(`GDP 변화율: ${percentChange.toFixed(2)}%`);

    return [currentGdp, parseFloat(percentChange.toFixed(2))];
  } catch (error) {
    debugLog(`GDP 데이터 조회 오류: ${error.stack}`);
    return [0, 0];
  }
}

// 대시보드 API 엔드포인트 정의
router.get("/nav-info", async (req, res) => {
  try {
    debugLog("nav-info API 요청 시작");

    // MongoDB 연결 상태 확인
    if (!mongoose.connection || mongoose.connection.readyState !== 1) {
      debugLog("MongoDB 연결 상태 오류");
      return res.status(500).json({
        error: "DB 연결 실패",
        readyState: mongoose.connection
          ? mongoose.connection.readyState
          : "undefined",
      });
    }

    debugLog(
      `MongoDB 연결 정보: ${mongoose.connection.name}, 상태: ${mongoose.connection.readyState}`
    );

    const redisClient = require("../config/redis");
    const cacheKey = "nav-info";

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
    const exchangeRatePromise = getExchangeRateData();
    const oilPricePromise = getOilPriceData();
    const interestRatePromise = getInterestRateData();
    const gdpPromise = getGdpData();

    // 비동기 작업 병렬 실행
    const [exchangeRate, oilPrice, interestRate, gdp] = await Promise.all([
      exchangeRatePromise,
      oilPricePromise,
      interestRatePromise,
      gdpPromise,
    ]);

    debugLog("모든 데이터 조회 완료");

    const data = {
      exchangeRate,
      oilPrice,
      interestRate,
      gdp,
    };

    debugLog("응답 데이터:", data);

    // Redis에 캐싱 (ENABLE_REDIS가 1인 경우)
    if (process.env.ENABLE_REDIS === "1") {
      await redisClient.set(cacheKey, JSON.stringify(data), { EX: 3600 }); // 1시간 캐싱
      debugLog("Redis에 데이터 캐싱 완료");
    }

    res.json({ source: "db", data });
  } catch (error) {
    debugLog(`nav-info API 오류: ${error.stack}`);
    res.status(500).json({ error: "서버 에러", message: error.message });
  }
});

// 기존 endpoints 배열 (다른 엔드포인트는 수정하지 않음)
const endpoints = ["bar-graph", "linear-graph", "comparison"];

endpoints.forEach((endpoint) => {
  router.get(`/${endpoint}`, async (req, res) => {
    // ... existing code ...
  });
});

module.exports = router;
