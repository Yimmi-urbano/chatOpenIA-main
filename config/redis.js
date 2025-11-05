const Redis = require('ioredis');
require('dotenv').config();

const redisClient = new Redis(process.env.REDIS_URI, {
  // Opciones adicionales de configuración de ioredis, si son necesarias.
  // Por ejemplo, para manejar reconexiones:
  retryStrategy: (times) => {
    const delay = Math.min(times * 50, 2000);
    return delay;
  },
});

redisClient.on('connect', () => {
  console.log('Conectado a Redis');
});

redisClient.on('error', (err) => {
  console.error('Error de conexión con Redis:', err);
});

module.exports = redisClient;
