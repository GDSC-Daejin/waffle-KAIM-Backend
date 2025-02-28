const mongoose = require("mongoose");
const { debugLog, formatDate } = require("./dateUtils");

/**
 * 최신 데이터 날짜 가져오기 (항상 오늘-1일이 최신 데이터)
 * @returns {Date} 최신 데이터 날짜
 */
function getLatestDataDate() {
  const koreanNow = require("./dateUtils").getKoreanNow();
  const latestDate = new Date(koreanNow);
  latestDate.setDate(latestDate.getDate() - 1); // 항상 하루 전 데이터가 최신
  return latestDate;
}

/**
 * MongoDB 연결 상태 확인 및 복구 시도
 * @returns {Promise<boolean>} 연결 상태
 */
async function ensureMongoConnection() {
  if (mongoose.connection && mongoose.connection.readyState === 1) {
    return true; // 이미 연결됨
  }
  
  debugLog("MongoDB 연결 상태 확인 중...");
  
  // 연결 상태가 아니면 재연결 시도
  if (mongoose.connection.readyState !== 1) {
    debugLog("MongoDB 연결 끊김, 재연결 시도");
    try {
      // 기존 연결이 있으면 정리
      if (mongoose.connection.readyState !== 0) {
        await mongoose.connection.close();
      }
      
      // 연결 재시도
      await mongoose.connect(process.env.MONGO_URI, {
        useNewUrlParser: true,
        useUnifiedTopology: true,
        serverSelectionTimeoutMS: 10000,
        socketTimeoutMS: 45000,
        keepAlive: true,
        keepAliveInitialDelay: 300000,
      });
      
      debugLog("MongoDB 재연결 성공");
      return true;
    } catch (error) {
      debugLog(`MongoDB 재연결 실패: ${error.message}`);
      return false;
    }
  }
  
  return false;
}

/**
 * 컬렉션 존재 여부 확인
 * @param {string} collectionName - 확인할 컬렉션 이름
 * @returns {Promise<boolean>} 컬렉션 존재 여부
 */
async function checkCollectionExists(collectionName) {
  try {
    // 연결 상태 확인
    await ensureMongoConnection();
    
    // 안전한 컬렉션 조회 시도
    const collections = await mongoose.connection.db
      .listCollections({ name: collectionName })
      .toArray();
    
    const exists = collections.length > 0;
    debugLog(`컬렉션 ${collectionName} 존재 여부: ${exists}`);
    return exists;
  } catch (error) {
    debugLog(`컬렉션 확인 오류: ${error.message}`);
    // 연결 재시도 후 다시 확인
    try {
      await ensureMongoConnection();
      const collections = await mongoose.connection.db
        .listCollections({ name: collectionName })
        .toArray();
      
      const exists = collections.length > 0;
      debugLog(`재시도 후 컬렉션 ${collectionName} 존재 여부: ${exists}`);
      return exists;
    } catch (retryError) {
      debugLog(`재시도 후에도 컬렉션 확인 오류: ${retryError.message}`);
      return false;
    }
  }
}

/**
 * 지정된 날짜에서 시작하여 가장 최근의 유효한 컬렉션 찾기
 * @param {Date} startDate - 시작 날짜
 * @returns {Promise<Object|null>} 컬렉션 정보 또는 null
 */
async function findMostRecentValidCollection(startDate) {
  const maxDaysBack = 30; // 최대 30일 전까지만 조회
  let currentDate = new Date(startDate);

  for (let i = 0; i < maxDaysBack; i++) {
    const collectionName = formatDate(currentDate);
    debugLog(`유효 컬렉션 탐색: ${collectionName} 확인 중`);

    if (await checkCollectionExists(collectionName)) {
      try {
        // 연결 상태 확인
        await ensureMongoConnection();
        
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

/**
 * 특정 컬렉션에서 필드값 조회 헬퍼 함수
 * @param {string} collectionName - 컬렉션 이름
 * @param {string} fieldName - 필드 이름
 * @returns {Promise<any>} 필드 값 또는 0
 */
async function getValueFromCollection(collectionName, fieldName) {
  try {
    // 연결 상태 확인
    await ensureMongoConnection();
    
    const data = await mongoose.connection.db
      .collection(collectionName)
      .findOne({});
    return data && data[fieldName] !== undefined ? data[fieldName] : 0;
  } catch (error) {
    debugLog(`${collectionName}에서 ${fieldName} 조회 오류: ${error.message}`);
    return 0;
  }
}

module.exports = {
  getLatestDataDate,
  checkCollectionExists,
  findMostRecentValidCollection,
  getValueFromCollection,
  ensureMongoConnection,
};
