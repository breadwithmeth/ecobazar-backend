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
exports.getAllRatings = exports.getCourierRatingStats = exports.getDeliveryRating = exports.createDeliveryRating = void 0;
const prisma_1 = __importDefault(require("../lib/prisma"));
const errorHandler_1 = require("../middlewares/errorHandler");
const apiResponse_1 = require("../utils/apiResponse");
const logger_1 = require("../utils/logger");
// Создать оценку доставки
const createDeliveryRating = (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    var _a;
    try {
        const { orderId, quality, speed, impression, comment } = req.body;
        const userId = req.user.id;
        // Проверяем существование заказа и права доступа
        const order = yield prisma_1.default.order.findUnique({
            where: { id: orderId },
            include: {
                statuses: {
                    orderBy: { createdAt: 'desc' },
                    take: 1,
                    select: { status: true }
                },
                deliveryRating: true
            }
        });
        if (!order) {
            throw new errorHandler_1.AppError('Заказ не найден', 404);
        }
        if (order.userId !== userId) {
            throw new errorHandler_1.AppError('Вы можете оценить только свои заказы', 403);
        }
        // Проверяем, что заказ доставлен
        const currentStatus = (_a = order.statuses[0]) === null || _a === void 0 ? void 0 : _a.status;
        if (currentStatus !== 'DELIVERED') {
            throw new errorHandler_1.AppError('Можно оценить только доставленные заказы', 400);
        }
        // Проверяем, что оценка еще не поставлена
        if (order.deliveryRating) {
            throw new errorHandler_1.AppError('Оценка для этого заказа уже поставлена', 400);
        }
        // Валидация оценок
        if (quality < 1 || quality > 5 || speed < 1 || speed > 5 || impression < 1 || impression > 5) {
            throw new errorHandler_1.AppError('Оценки должны быть в диапазоне от 1 до 5', 400);
        }
        // Создаем оценку
        const rating = yield prisma_1.default.deliveryRating.create({
            data: {
                orderId,
                userId,
                courierId: order.courierId,
                quality,
                speed,
                impression,
                comment: comment === null || comment === void 0 ? void 0 : comment.trim()
            },
            include: {
                order: {
                    select: { id: true, address: true }
                },
                courier: {
                    select: { id: true, name: true }
                }
            }
        });
        logger_1.logger.info(`Пользователь ${userId} поставил оценку доставки для заказа ${orderId}: качество ${quality}, скорость ${speed}, впечатление ${impression}`);
        apiResponse_1.ApiResponseUtil.success(res, rating, 'Спасибо за оценку! Ваше мнение поможет нам улучшить качество доставки');
    }
    catch (error) {
        next(error);
    }
});
exports.createDeliveryRating = createDeliveryRating;
// Получить оценку доставки по заказу
const getDeliveryRating = (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { orderId } = req.params;
        const userId = req.user.id;
        const isAdmin = req.user.role === 'ADMIN';
        const rating = yield prisma_1.default.deliveryRating.findUnique({
            where: { orderId: parseInt(orderId) },
            include: {
                order: {
                    select: { id: true, address: true, userId: true }
                },
                user: {
                    select: { id: true, name: true }
                },
                courier: {
                    select: { id: true, name: true }
                }
            }
        });
        if (!rating) {
            throw new errorHandler_1.AppError('Оценка не найдена', 404);
        }
        // Проверяем права доступа
        if (!isAdmin && rating.order.userId !== userId) {
            throw new errorHandler_1.AppError('Недостаточно прав доступа', 403);
        }
        apiResponse_1.ApiResponseUtil.success(res, rating);
    }
    catch (error) {
        next(error);
    }
});
exports.getDeliveryRating = getDeliveryRating;
// Получить статистику оценок курьера (для админов)
const getCourierRatingStats = (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { courierId } = req.params;
        // Проверяем существование курьера
        const courier = yield prisma_1.default.user.findUnique({
            where: { id: parseInt(courierId) },
            select: { id: true, name: true, role: true }
        });
        if (!courier) {
            throw new errorHandler_1.AppError('Курьер не найден', 404);
        }
        if (courier.role !== 'COURIER') {
            throw new errorHandler_1.AppError('Указанный пользователь не является курьером', 400);
        }
        // Получаем статистику оценок
        const ratings = yield prisma_1.default.deliveryRating.findMany({
            where: { courierId: parseInt(courierId) },
            select: {
                quality: true,
                speed: true,
                impression: true,
                createdAt: true
            }
        });
        if (ratings.length === 0) {
            return apiResponse_1.ApiResponseUtil.success(res, {
                courier,
                totalRatings: 0,
                averageQuality: 0,
                averageSpeed: 0,
                averageImpression: 0,
                overallAverage: 0,
                distribution: {
                    quality: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 },
                    speed: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 },
                    impression: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 }
                }
            });
        }
        // Вычисляем средние значения
        const averageQuality = ratings.reduce((sum, r) => sum + r.quality, 0) / ratings.length;
        const averageSpeed = ratings.reduce((sum, r) => sum + r.speed, 0) / ratings.length;
        const averageImpression = ratings.reduce((sum, r) => sum + r.impression, 0) / ratings.length;
        const overallAverage = (averageQuality + averageSpeed + averageImpression) / 3;
        // Вычисляем распределение оценок
        const distribution = {
            quality: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 },
            speed: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 },
            impression: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 }
        };
        ratings.forEach(rating => {
            distribution.quality[rating.quality]++;
            distribution.speed[rating.speed]++;
            distribution.impression[rating.impression]++;
        });
        const stats = {
            courier,
            totalRatings: ratings.length,
            averageQuality: Math.round(averageQuality * 10) / 10,
            averageSpeed: Math.round(averageSpeed * 10) / 10,
            averageImpression: Math.round(averageImpression * 10) / 10,
            overallAverage: Math.round(overallAverage * 10) / 10,
            distribution
        };
        apiResponse_1.ApiResponseUtil.success(res, stats);
    }
    catch (error) {
        next(error);
    }
});
exports.getCourierRatingStats = getCourierRatingStats;
// Получить все оценки для заказов (для админов)
const getAllRatings = (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { page = 1, limit = 10, courierId, minRating, maxRating } = req.query;
        const skip = (Number(page) - 1) * Number(limit);
        const whereClause = {};
        if (courierId) {
            whereClause.courierId = parseInt(courierId);
        }
        if (minRating || maxRating) {
            whereClause.AND = [];
            if (minRating) {
                const min = parseInt(minRating);
                whereClause.AND.push({
                    OR: [
                        { quality: { gte: min } },
                        { speed: { gte: min } },
                        { impression: { gte: min } }
                    ]
                });
            }
            if (maxRating) {
                const max = parseInt(maxRating);
                whereClause.AND.push({
                    AND: [
                        { quality: { lte: max } },
                        { speed: { lte: max } },
                        { impression: { lte: max } }
                    ]
                });
            }
        }
        const total = yield prisma_1.default.deliveryRating.count({ where: whereClause });
        const ratings = yield prisma_1.default.deliveryRating.findMany({
            where: whereClause,
            skip,
            take: Number(limit),
            orderBy: { createdAt: 'desc' },
            include: {
                order: {
                    select: { id: true, address: true, deliveryType: true, scheduledDate: true }
                },
                user: {
                    select: { id: true, name: true, telegram_user_id: true }
                },
                courier: {
                    select: { id: true, name: true }
                }
            }
        });
        apiResponse_1.ApiResponseUtil.paginated(res, ratings, {
            page: Number(page),
            limit: Number(limit),
            total
        });
    }
    catch (error) {
        next(error);
    }
});
exports.getAllRatings = getAllRatings;
