const cron = require("node-cron");
const redisClient = require("../config/redis");
const mongoose = require("mongoose");

// 날짜 관련 유틸리티 함수
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

// 대시보드 데이터 수집 함수 (nav-info 데이터 수집 추가)
async function collectDashboardData() {
  try {
    // 날짜 계산
    const koreanNow = getKoreanNow();
    const today = new Date(koreanNow);
    const yesterday = new Date(koreanNow.getTime() - 24 * 60 * 60 * 1000);

    const todayCollection = formatDate(today);
    const yesterdayCollection = formatDate(yesterday);

    // 데이터 조회
    const todayData = await mongoose.connection.db
      .collection(todayCollection)
      .findOne({});
    const yesterdayData = await mongoose.connection.db
      .collection(yesterdayCollection)
      .findOne({});

    if (!todayData || !yesterdayData) {
      throw new Error("오늘 또는 어제 데이터가 없습니다.");
    }

    // 환율 계산
    const exchangeRate = [
      todayData.KRW_Rating,
      todayData.KRW_Rating - yesterdayData.KRW_Rating,
    ];

    // 국제유가 평균 계산
    const todayOilAvg =
      (todayData.Dubai_Val + todayData.Brent_Val + todayData.WTI_Val) / 3;
    const yesterdayOilAvg =
      (yesterdayData.Dubai_Val +
        yesterdayData.Brent_Val +
        yesterdayData.WTI_Val) /
      3;
    const oilPrice = [
      parseFloat(todayOilAvg.toFixed(2)),
      parseFloat((todayOilAvg - yesterdayOilAvg).toFixed(2)),
    ];

    // 금리 데이터 계산
    let interestRate = [todayData.interest_rate, 0];

    // 이전 다른 금리를 찾을 때까지 과거 데이터 조회
    let previousRate = todayData.interest_rate;
    let dayDiff = 1;

    while (previousRate === todayData.interest_rate && dayDiff < 365) {
      const pastDate = new Date(
        today.getTime() - dayDiff * 24 * 60 * 60 * 1000
      );
      const pastCollection = formatDate(pastDate);

      try {
        const pastData = await mongoose.connection.db
          .collection(pastCollection)
          .findOne({});
        if (pastData && pastData.interest_rate !== todayData.interest_rate) {
          previousRate = pastData.interest_rate;
          interestRate[1] = todayData.interest_rate - previousRate;
          break;
        }
      } catch (err) {
        // 조회할 컬렉션이 없을 수 있으므로 오류 무시
      }

      dayDiff++;
    }

    // 금리 데이터 별도 저장 (24시간 유효)
    await redisClient.set("interest_rate_data", JSON.stringify(interestRate), {
      EX: 86400,
    });

    // GDP 계산은 더 복잡하므로 여기서는 생략 (실제 API 호출 시 계산)
    const gdp = [todayData.gdp || 0, 0];

    // nav-info 데이터 종합
    const navInfoData = {
      exchangeRate,
      oilPrice,
      interestRate,
      gdp,
    };

    return {
      "nav-info": navInfoData,
      "bar-graph": { message: "실제 DB에서 가져온 대쉬보드 bar-graph 데이터" },
      "linear-graph": {
        message: "실제 DB에서 가져온 대쉬보드 linear-graph 데이터",
      },
      comparison: { message: "실제 DB에서 가져온 대쉬보드 comparison 데이터" },
    };
  } catch (error) {
    console.error("데이터 수집 중 오류 발생:", error);
    throw error;
  }
}

const task = cron.schedule(
  "0 5 * * *",
  async () => {
    console.log("스케줄러: 대쉬보드 데이터를 Redis에 캐싱합니다.");
    try {
      // 데이터 수집
      const dataForKeys = await collectDashboardData();

      // Redis에 저장
      for (const key in dataForKeys) {
        await redisClient.set(key, JSON.stringify(dataForKeys[key]), {
          EX: 3600,
        });
      }
      console.log("캐시 업데이트 완료");
    } catch (error) {
      console.error("캐시 업데이트 실패:", error);
    }
  },
  { scheduled: false }
);

module.exports = task;
