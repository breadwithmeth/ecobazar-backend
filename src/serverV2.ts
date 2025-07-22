import app from './appV2';
import { logger } from './utils/logger';

const PORT = process.env.PORT || 4000;

const server = app.listen(PORT, () => {
  logger.info(`🚀 EcoBazar Backend V2 запущен на порту ${PORT}`, {
    environment: process.env.NODE_ENV || 'development',
    nodeVersion: process.version,
    port: PORT
  });
});

// Graceful shutdown
const gracefulShutdown = async (signal: string) => {
  logger.info(`Получен сигнал ${signal}, начинаем graceful shutdown...`);
  
  server.close((err) => {
    if (err) {
      logger.error('Ошибка при закрытии сервера', { error: err.message });
      process.exit(1);
    }
    
    logger.info('Сервер успешно закрыт');
    process.exit(0);
  });
  
  // Форсированное завершение через 30 секунд
  setTimeout(() => {
    logger.error('Принудительное завершение работы сервера');
    process.exit(1);
  }, 30000);
};

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

export default server;
