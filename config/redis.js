const redis = require("redis");

if (process.env.ENABLE_REDIS === "1") {
  const redisClient = redis.createClient({
    url: process.env.REDIS_URL || "redis://localhost:6379",
  });
  redisClient.on("error", (err) => console.error("Redis Client Error", err));
  redisClient.connect();
  module.exports = redisClient;
} else {
  console.log("Redis is disabled");
  // 더미 함수 제공: 실제로는 아무 작업도 수행하지 않음.
  module.exports = {
    get: async () => null,
    set: async () => {},
  };
}
