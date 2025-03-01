require("dotenv").config();
const mongoose = require("mongoose");
const { debugLog } = require("../utils/dateUtils");

// 예측 DB 연결 정보
const predictConnection = mongoose.createConnection(process.env.MONGO_URI2, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
  serverSelectionTimeoutMS: 10000,
  socketTimeoutMS: 45000,
  keepAlive: true,
  keepAliveInitialDelay: 300000,
  connectTimeoutMS: 30000,
  maxPoolSize: 10,
});

// 연결 이벤트 리스너 설정
predictConnection.on('connected', () => {
  console.log('예측 DB(oil_predict) 연결 성공');
  debugLog('예측 DB(oil_predict) 연결 성공');
});

predictConnection.on('error', (err) => {
  console.error('예측 DB 연결 오류:', err);
  debugLog(`예측 DB 연결 오류: ${err.message}`);
});

predictConnection.on('disconnected', () => {
  console.log('예측 DB 연결이 끊어짐');
  debugLog('예측 DB 연결이 끊어짐');
  
  // 재연결 시도
  setTimeout(() => {
    predictConnection.openUri(process.env.MONGO_URI2, {
      useNewUrlParser: true,
      useUnifiedTopology: true
    }).then(() => {
      debugLog('예측 DB 재연결 성공');
    }).catch(err => {
      debugLog(`예측 DB 재연결 실패: ${err.message}`);
    });
  }, 3000);
});

module.exports = predictConnection;
