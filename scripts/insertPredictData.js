require('dotenv').config();
const { MongoClient } = require('mongodb');

// 연료별 랜덤 생성 범위 (최소, 최대)
const ranges = {
  "gasoline": [1700, 1900],
  "premiumGasoline": [1900, 2100],
  "diesel": [1400, 1600],
  "kerosene": [950, 1200]
};

// 각 항목당 생성할 값의 개수
const numValues = 17;

// DB 예시 데이터 생성 (p0 ~ p6)
const generateData = () => {
  const dbData = {};
  for (let i = 0; i < 7; i++) {
    const key = `p${i}`;
    dbData[key] = {};
    
    for (const [fuel, [low, high]] of Object.entries(ranges)) {
      // 랜덤한 값을 생성 후, 소수점 두 자리 문자열로 변환
      const values = Array.from({ length: numValues }, () => 
        (Math.random() * (high - low) + low).toFixed(2)
      );
      dbData[key][fuel] = values;
    }
  }
  return dbData;
};

// MongoDB에 데이터 업로드
async function uploadData() {
  // MongoDB 연결 URI
  const MONGO_URI = process.env.MONGO_URI2;
  if (!MONGO_URI) {
    console.error('MongoDB URI is not defined in .env file');
    process.exit(1);
  }

  const client = new MongoClient(MONGO_URI);

  try {
    await client.connect();
    console.log('Connected to MongoDB');

    // 데이터베이스 선택
    const db = client.db("oil_predict");

    // 오늘 날짜를 "YYYY_MM_DD" 형식으로 구하기
    const today = new Date();
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, '0');
    const day = String(today.getDate()).padStart(2, '0');
    const todayStr = `${year}_${month}_${day}`;

    // 컬렉션 이름 설정
    const collectionName = `Predict_${todayStr}`;
    const collection = db.collection(collectionName);

    // 데이터 생성
    const data = generateData();
    
    // 디버깅용 출력
    console.log(JSON.stringify(data, null, 4));

    // 데이터 업로드
    const result = await collection.insertOne(data);
    console.log(`Inserted document ID: ${result.insertedId}`);
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await client.close();
    console.log('MongoDB connection closed');
  }
}

// 함수 실행
uploadData();
