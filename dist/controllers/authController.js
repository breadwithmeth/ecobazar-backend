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
exports.registerOrLogin = void 0;
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const prisma_1 = __importDefault(require("../lib/prisma"));
const errorHandler_1 = require("../middlewares/errorHandler");
const apiResponse_1 = require("../utils/apiResponse");
const logger_1 = require("../middlewares/logger");
const generateToken = (user) => {
    const payload = {
        userId: user.id,
        role: user.role
    };
    return jsonwebtoken_1.default.sign(payload, process.env.JWT_SECRET, {
        expiresIn: '7d',
        issuer: 'ecobazar-backend',
        audience: 'ecobazar-users'
    });
};
const registerOrLogin = (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { telegram_user_id } = req.body;
        if (!telegram_user_id) {
            throw new errorHandler_1.AppError('telegram_user_id обязателен', 400);
        }
        // Проверяем формат telegram_user_id
        if (typeof telegram_user_id !== 'string' && typeof telegram_user_id !== 'number') {
            throw new errorHandler_1.AppError('telegram_user_id должен быть строкой или числом', 400);
        }
        const telegramIdStr = String(telegram_user_id);
        // Ищем существующего пользователя
        let user = yield prisma_1.default.user.findUnique({
            where: { telegram_user_id: telegramIdStr },
            select: {
                id: true,
                telegram_user_id: true,
                role: true,
                name: true,
                phone_number: true
            }
        });
        if (user) {
            // Логин существующего пользователя
            const token = generateToken(user);
            console.log(`✅ User login: ${user.id} (${user.telegram_user_id})`);
            apiResponse_1.ApiResponseUtil.success(res, {
                token,
                user: {
                    id: user.id,
                    telegram_user_id: user.telegram_user_id,
                    role: user.role,
                    name: user.name,
                    phone_number: user.phone_number
                }
            }, 'Успешная авторизация');
        }
        else {
            // Регистрация нового пользователя
            user = yield prisma_1.default.user.create({
                data: { telegram_user_id: telegramIdStr },
                select: {
                    id: true,
                    telegram_user_id: true,
                    role: true,
                    name: true,
                    phone_number: true
                }
            });
            const token = generateToken(user);
            console.log(`🆕 User registered: ${user.id} (${user.telegram_user_id})`);
            apiResponse_1.ApiResponseUtil.created(res, {
                token,
                user: {
                    id: user.id,
                    telegram_user_id: user.telegram_user_id,
                    role: user.role,
                    name: user.name,
                    phone_number: user.phone_number
                }
            }, 'Пользователь успешно зарегистрирован');
        }
    }
    catch (error) {
        if (error instanceof errorHandler_1.AppError) {
            logger_1.securityLogger.logFailedAuth(req, error.message);
        }
        next(error);
    }
});
exports.registerOrLogin = registerOrLogin;
