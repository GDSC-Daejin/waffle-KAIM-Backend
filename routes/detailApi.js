const express = require("express");
const router = express.Router();

router.post("/date", async (req, res) => {
  try {
    const { date } = req.body;
    if (!date)
      return res.status(400).json({ error: "날짜 데이터가 필요합니다." });
    // ...여기서 실제 DB 조회 로직...
    const data = { message: `${date} 기준 디테일 데이터 (예시)` };
    res.json(data);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "서버 에러" });
  }
});

module.exports = router;
