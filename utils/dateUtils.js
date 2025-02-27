/**
 * 현재 한국 시간을 반환하는 함수
 * @returns {Date} 한국 시간으로 조정된 Date 객체
 */
function getKoreanNow() {
  const now = new Date();
  const utc = now.getTime() + now.getTimezoneOffset() * 60000;
  return new Date(utc + 9 * 3600000); // UTC+9 (한국 시간)
}

/**
 * Date 객체를 컬렉션명 형식(Date_YYYY_MM_DD)으로 변환
 * @param {Date} date - 변환할 날짜 객체
 * @returns {string} 컬렉션명 형식의 문자열
 */
function formatDate(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `Date_${year}_${month}_${day}`;
}

/**
 * 분기 문자열(YYYYQQ)에서 해당 분기의 중간 날짜를 계산
 * @param {string} yearQuarter - YYYYQQ 형식의 분기 문자열 (예: 202403)
 * @returns {Date} 해당 분기의 중간 날짜
 */
function getQuarterMiddleDate(yearQuarter) {
  const yearQuarterStr = String(yearQuarter);
  const year = parseInt(yearQuarterStr.substring(0, 4));
  const quarter = parseInt(yearQuarterStr.substring(4, 6));

  // 각 분기의 중간 달(2,5,8,11)의 15일을 반환
  const month = (quarter - 1) * 3 + 2;
  return new Date(year, month - 1, 15);
}

/**
 * 디버그 모드 로그 출력
 * @param {string} message - 로그 메시지
 * @param {any} data - 출력할 데이터 (선택사항)
 */
function debugLog(message, data = null) {
  if (process.env.DEBUG_MODE === "1") {
    console.log(`[DEBUG] ${message}`);
    if (data)
      console.log(
        typeof data === "object" ? JSON.stringify(data, null, 2) : data
      );
  }
}

module.exports = {
  getKoreanNow,
  formatDate,
  getQuarterMiddleDate,
  debugLog,
};
