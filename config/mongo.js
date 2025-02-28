require("dotenv").config();
const mongoose = require("mongoose");

// strictQuery 경고 해결
mongoose.set('strictQuery', false);

// 연결 이벤트 리스너 설정
mongoose.connection.on('error', (err) => {
  console.error('MongoDB 연결 오류:', err);
});

mongoose.connection.on('disconnected', () => {
  console.log('MongoDB 연결이 끊어짐, 재연결 시도 중...');
  connectWithRetry();
});

// 재연결 함수
function connectWithRetry() {
  mongoose.connect(process.env.MONGO_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
    serverSelectionTimeoutMS: 10000, // 서버 선택 타임아웃
    socketTimeoutMS: 45000, // 소켓 타임아웃
    keepAlive: true, // 연결 유지
    keepAliveInitialDelay: 300000, // keepAlive 초기 지연 (ms)
    connectTimeoutMS: 30000, // 연결 타임아웃
    maxPoolSize: 10, // 최대 연결 풀 크기
  })
  .then(() => console.log('MongoDB 연결 성공'))
  .catch(err => {
    console.error('MongoDB 연결 실패:', err);
    // 3초 후 재시도
    setTimeout(connectWithRetry, 3000);
  });
}

// 초기 연결 시도
connectWithRetry();

module.exports = mongoose;
