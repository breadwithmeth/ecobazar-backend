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
exports.isOwnerOrAdmin = exports.isAdminOrCourier = exports.isSeller = exports.isCourier = exports.isAdmin = exports.authenticate = void 0;
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const prisma_1 = __importDefault(require("../lib/prisma"));
const errorHandler_1 = require("./errorHandler");
const logger_1 = require("./logger");
const authenticate = (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const authHeader = req.headers.authorization;
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            logger_1.securityLogger.logFailedAuth(req, 'Missing or invalid authorization header');
            throw new errorHandler_1.AppError('Токен не предоставлен', 401);
        }
        const token = authHeader.split(' ')[1];
        if (!token) {
            logger_1.securityLogger.logFailedAuth(req, 'Empty token');
            throw new errorHandler_1.AppError('Токен не предоставлен', 401);
        }
        // Проверяем JWT токен
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
            logger_1.securityLogger.logFailedAuth(req, `User not found: ${payload.userId}`);
            throw new errorHandler_1.AppError('Пользователь не найден', 401);
        }
        // Проверяем, что роль в токене соответствует роли в БД
        if (user.role !== payload.role) {
            logger_1.securityLogger.logFailedAuth(req, `Role mismatch for user: ${payload.userId}`);
            throw new errorHandler_1.AppError('Недействительный токен', 401);
        }
        req.user = user;
        next();
    }
    catch (error) {
        if (error instanceof jsonwebtoken_1.default.JsonWebTokenError) {
            logger_1.securityLogger.logFailedAuth(req, `Invalid JWT: ${error.message}`);
            next(new errorHandler_1.AppError('Недействительный токен', 401));
        }
        else if (error instanceof jsonwebtoken_1.default.TokenExpiredError) {
            logger_1.securityLogger.logFailedAuth(req, 'Expired JWT');
            next(new errorHandler_1.AppError('Токен истек', 401));
        }
        else {
            next(error);
        }
    }
});
exports.authenticate = authenticate;
const isAdmin = (req, res, next) => {
    try {
        if (!req.user) {
            throw new errorHandler_1.AppError('Пользователь не авторизован', 401);
        }
        if (req.user.role !== 'ADMIN') {
            logger_1.securityLogger.logUnauthorizedAccess(req, 'Admin endpoint');
            throw new errorHandler_1.AppError('Требуется роль администратора', 403);
        }
        next();
    }
    catch (error) {
        next(error);
    }
};
exports.isAdmin = isAdmin;
const isCourier = (req, res, next) => {
    try {
        if (!req.user) {
            throw new errorHandler_1.AppError('Пользователь не авторизован', 401);
        }
        if (req.user.role !== 'COURIER') {
            logger_1.securityLogger.logUnauthorizedAccess(req, 'Courier endpoint');
            throw new errorHandler_1.AppError('Требуется роль курьера', 403);
        }
        next();
    }
    catch (error) {
        next(error);
    }
};
exports.isCourier = isCourier;
const isSeller = (req, res, next) => {
    try {
        if (!req.user) {
            throw new errorHandler_1.AppError('Пользователь не авторизован', 401);
        }
        if (req.user.role !== 'SELLER') {
            logger_1.securityLogger.logUnauthorizedAccess(req, 'Seller endpoint');
            throw new errorHandler_1.AppError('Требуется роль продавца', 403);
        }
        next();
    }
    catch (error) {
        next(error);
    }
};
exports.isSeller = isSeller;
const isAdminOrCourier = (req, res, next) => {
    try {
        if (!req.user) {
            throw new errorHandler_1.AppError('Пользователь не авторизован', 401);
        }
        if (req.user.role !== 'ADMIN' && req.user.role !== 'COURIER') {
            logger_1.securityLogger.logUnauthorizedAccess(req, 'Admin/Courier endpoint');
            throw new errorHandler_1.AppError('Требуется роль администратора или курьера', 403);
        }
        next();
    }
    catch (error) {
        next(error);
    }
};
exports.isAdminOrCourier = isAdminOrCourier;
const isOwnerOrAdmin = (getUserId) => {
    return (req, res, next) => {
        try {
            if (!req.user) {
                throw new errorHandler_1.AppError('Пользователь не авторизован', 401);
            }
            const resourceUserId = getUserId(req);
            if (req.user.role !== 'ADMIN' && req.user.id !== resourceUserId) {
                logger_1.securityLogger.logUnauthorizedAccess(req, `Resource belonging to user ${resourceUserId}`);
                throw new errorHandler_1.AppError('Доступ запрещен', 403);
            }
            next();
        }
        catch (error) {
            next(error);
        }
    };
};
exports.isOwnerOrAdmin = isOwnerOrAdmin;
