const Redis = require('ioredis');

const redis = new Redis({
  host: process.env.REDIS_HOST,
  port: Number(process.env.REDIS_PORT) || 6379,
  password: process.env.REDIS_PASSWORD || undefined,
  retryStrategy(times) {
    return Math.min(times * 50, 2000);
  },
});

redis.on('connect', () => {
  console.log('✅ Conectado a Redis');
});

redis.on('error', (err) => {
  console.error('❌ Error en la conexión con Redis:', err);
});

module.exports = redis;
