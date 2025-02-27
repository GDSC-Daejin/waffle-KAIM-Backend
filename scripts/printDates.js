require("dotenv").config();
require("../config/mongo"); // DB 연결 모듈 로드
const mongoose = require("mongoose");

// Mongoose debug 활성화 (필요시)
// mongoose.set("debug", true);

function getKoreanNow() {
  const now = new Date();
  const utc = now.getTime() + now.getTimezoneOffset() * 60000;
  return new Date(utc + 9 * 3600000);
}

function formatDate(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `Date_${year}_${month}_${day}`;
}

const MS_PER_DAY = 24 * 60 * 60 * 1000;
const koreanNow = getKoreanNow();
const date1 = new Date(koreanNow.getTime() - MS_PER_DAY); // 어제
const date2 = new Date(date1.getTime() - MS_PER_DAY); // 그제
const date3 = new Date(date2.getTime() - MS_PER_DAY); // 그그제

const collectionNames = [
  formatDate(date1),
  formatDate(date2),
  formatDate(date3),
];

console.log("printDates 스크립트 시작");

// MongoDB 연결이 완료된 후 실행
mongoose.connection.once("open", async () => {
  console.log("MongoDB 연결 완료 (open 이벤트)");
  try {
    for (const name of collectionNames) {
      console.log(`컬랙션 [${name}] 조회 시도`);
      const collection = mongoose.connection.db.collection(name);
      const data = await collection.find({}).toArray();
      console.log(`컬랙션 [${name}] 조회 완료, 레코드 수: ${data.length}`);
      console.log(data);
    }
  } catch (error) {
    console.error("컬랙션 데이터 조회 중 오류 발생:");
    console.error(error.stack);
  } finally {
    console.log("MongoDB 연결 종료");
    mongoose.connection.close();
  }
});
