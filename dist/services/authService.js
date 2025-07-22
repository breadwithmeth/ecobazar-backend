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
exports.AuthService = void 0;
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const prisma_1 = __importDefault(require("../lib/prisma"));
const errorHandler_1 = require("../middlewares/errorHandler");
class AuthService {
    generateToken(user) {
        const payload = {
            userId: user.id,
            role: user.role
        };
        return jsonwebtoken_1.default.sign(payload, process.env.JWT_SECRET, {
            expiresIn: '7d',
            issuer: 'ecobazar-backend',
            audience: 'ecobazar-users'
        });
    }
    registerOrLogin(telegram_user_id) {
        return __awaiter(this, void 0, void 0, function* () {
            if (!telegram_user_id) {
                throw new errorHandler_1.AppError('telegram_user_id обязателен', 400);
            }
            // Проверяем формат telegram_user_id
            if (typeof telegram_user_id !== 'string' && typeof telegram_user_id !== 'number') {
                throw new errorHandler_1.AppError('telegram_user_id должен быть строкой или числом', 400);
            }
            const telegramIdStr = String(telegram_user_id);
            // Проверяем формат
            if (!/^\d+$/.test(telegramIdStr)) {
                throw new errorHandler_1.AppError('telegram_user_id должен содержать только цифры', 400);
            }
            if (telegramIdStr.length < 3 || telegramIdStr.length > 15) {
                throw new errorHandler_1.AppError('telegram_user_id должен содержать от 5 до 15 цифр', 400);
            }
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
                const token = this.generateToken(user);
                return {
                    token,
                    user: {
                        id: user.id,
                        telegram_user_id: user.telegram_user_id,
                        role: user.role,
                        name: user.name,
                        phone_number: user.phone_number
                    }
                };
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
                const token = this.generateToken(user);
                return {
                    token,
                    user: {
                        id: user.id,
                        telegram_user_id: user.telegram_user_id,
                        role: user.role,
                        name: user.name,
                        phone_number: user.phone_number
                    }
                };
            }
        });
    }
    verifyToken(token) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const payload = jsonwebtoken_1.default.verify(token, process.env.JWT_SECRET);
                // Проверяем существование пользователя
                const user = yield prisma_1.default.user.findUnique({
                    where: { id: payload.userId },
                    select: {
                        id: true,
                        telegram_user_id: true,
                        phone_number: true,
                        role: true,
                        name: true
                    }
                });
                if (!user) {
                    throw new errorHandler_1.AppError('Пользователь не найден', 401);
                }
                // Проверяем, что роль в токене соответствует роли в БД
                if (user.role !== payload.role) {
                    throw new errorHandler_1.AppError('Недействительный токен', 401);
                }
                return user;
            }
            catch (error) {
                if (error instanceof jsonwebtoken_1.default.JsonWebTokenError) {
                    throw new errorHandler_1.AppError('Недействительный токен', 401);
                }
                else if (error instanceof jsonwebtoken_1.default.TokenExpiredError) {
                    throw new errorHandler_1.AppError('Токен истек', 401);
                }
                throw error;
            }
        });
    }
    updateUser(userId, data) {
        return __awaiter(this, void 0, void 0, function* () {
            const user = yield prisma_1.default.user.findUnique({
                where: { id: userId }
            });
            if (!user) {
                throw new errorHandler_1.AppError('Пользователь не найден', 404);
            }
            if (!data.name && !data.phone_number) {
                throw new errorHandler_1.AppError('Нужно передать name или phone_number', 400);
            }
            // Валидация номера телефона
            if (data.phone_number && !/^\+?[1-9]\d{1,14}$/.test(data.phone_number)) {
                throw new errorHandler_1.AppError('Неверный формат номера телефона', 400);
            }
            const updateData = {};
            if (data.name !== undefined)
                updateData.name = data.name.trim();
            if (data.phone_number !== undefined)
                updateData.phone_number = data.phone_number;
            return prisma_1.default.user.update({
                where: { id: userId },
                data: updateData,
                select: {
                    id: true,
                    telegram_user_id: true,
                    role: true,
                    phone_number: true,
                    name: true
                }
            });
        });
    }
    getUserById(userId) {
        return __awaiter(this, void 0, void 0, function* () {
            const user = yield prisma_1.default.user.findUnique({
                where: { id: userId },
                select: {
                    id: true,
                    telegram_user_id: true,
                    role: true,
                    phone_number: true,
                    name: true
                }
            });
            if (!user) {
                throw new errorHandler_1.AppError('Пользователь не найден', 404);
            }
            return user;
        });
    }
}
exports.AuthService = AuthService;
