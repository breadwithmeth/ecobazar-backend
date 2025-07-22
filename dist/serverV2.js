"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const appV2_1 = __importDefault(require("./appV2"));
const logger_1 = require("./utils/logger");
const PORT = process.env.PORT || 4000;
const server = appV2_1.default.listen(PORT, () => {
    logger_1.logger.info(`🚀 EcoBazar Backend V2 запущен на порту ${PORT}`, {
        environment: process.env.NODE_ENV || 'development',
        nodeVersion: process.version,
        port: PORT
    });
});
// Graceful shutdown
const gracefulShutdown = (signal) => __awaiter(void 0, void 0, void 0, function* () {
    logger_1.logger.info(`Получен сигнал ${signal}, начинаем graceful shutdown...`);
    server.close((err) => {
        if (err) {
            logger_1.logger.error('Ошибка при закрытии сервера', { error: err.message });
            process.exit(1);
        }
        logger_1.logger.info('Сервер успешно закрыт');
        process.exit(0);
    });
    // Форсированное завершение через 30 секунд
    setTimeout(() => {
        logger_1.logger.error('Принудительное завершение работы сервера');
        process.exit(1);
    }, 30000);
});
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));
exports.default = server;
