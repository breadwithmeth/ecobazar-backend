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
exports.getCourierOrder = exports.getCourierStatsById = exports.getCourierStats = exports.getCouriers = exports.assignCourierToOrder = exports.updateOrderStatusByCourier = exports.getCourierOrders = void 0;
const zod_1 = require("zod");
const errorHandler_1 = require("../middlewares/errorHandler");
const apiResponse_1 = require("../utils/apiResponse");
const cache_1 = require("../utils/cache");
const orderService_1 = require("../services/orderService");
const telegramService_1 = require("../services/telegramService");
const schemas_1 = require("../validators/schemas");
const zodValidation_1 = require("../middlewares/zodValidation");
const logger_1 = require("../utils/logger");
const prisma_1 = __importDefault(require("../lib/prisma"));
const orderService = new orderService_1.OrderService();
// Получить заказы курьера
exports.getCourierOrders = [
    (0, zodValidation_1.validateQuery)(schemas_1.paginationSchema.extend({
        status: zod_1.z.string().optional()
    })),
    (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
        try {
            const { page, limit, sortBy, sortOrder, status } = req.validatedQuery;
            const pagination = { page, limit, sortBy, sortOrder };
            const courierId = req.user.id;
            // Генерируем ключ кэша для заказов курьера
            const cacheKey = cache_1.CacheService.generatePaginationKey(`courier:${courierId}:orders`, page, limit, { status, sortBy, sortOrder });
            const result = yield cache_1.cacheService.memoize(cacheKey, () => __awaiter(void 0, void 0, void 0, function* () {
                const whereClause = { courierId };
                if (status) {
                    whereClause.statuses = {
                        some: { status }
                    };
                }
                const skip = (page - 1) * limit;
                const total = yield prisma_1.default.order.count({ where: whereClause });
                const orders = yield prisma_1.default.order.findMany({
                    where: whereClause,
                    skip,
                    take: limit,
                    orderBy: { [sortBy]: sortOrder },
                    include: {
                        items: {
                            include: {
                                product: {
                                    select: { id: true, name: true, price: true, image: true }
                                }
                            }
                        },
                        user: {
                            select: {
                                id: true,
                                telegram_user_id: true,
                                name: true,
                                phone_number: true
                            }
                        },
                        statuses: {
                            orderBy: { createdAt: 'desc' },
                            select: { id: true, status: true, createdAt: true },
                            take: 1
                        }
                    }
                });
                // Добавляем общую сумму и текущий статус к каждому заказу
                const ordersWithDetails = orders.map((order) => {
                    var _a, _b;
                    return (Object.assign(Object.assign({}, order), { totalAmount: order.items.reduce((sum, item) => sum + (item.price || 0) * item.quantity, 0), currentStatus: ((_a = order.statuses[0]) === null || _a === void 0 ? void 0 : _a.status) || 'NEW', statusUpdatedAt: (_b = order.statuses[0]) === null || _b === void 0 ? void 0 : _b.createdAt }));
                });
                return {
                    data: ordersWithDetails,
                    meta: {
                        page,
                        limit,
                        total,
                        totalPages: Math.ceil(total / limit)
                    }
                };
            }), 2 * 60 * 1000 // 2 минуты кэш
            );
            apiResponse_1.ApiResponseUtil.paginated(res, result.data, result.meta);
        }
        catch (error) {
            next(error);
        }
    })
];
// Обновить статус заказа курьером (только на DELIVERED)
exports.updateOrderStatusByCourier = [
    (0, zodValidation_1.validateParams)(schemas_1.idSchema),
    (0, zodValidation_1.validateBody)(schemas_1.courierOrderStatusSchema),
    (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
        var _a;
        try {
            const { id: orderId } = req.validatedParams;
            const { status } = req.body;
            const courierId = req.user.id;
            // Проверяем, что заказ назначен этому курьеру
            const order = yield prisma_1.default.order.findUnique({
                where: { id: orderId },
                select: {
                    id: true,
                    courierId: true,
                    statuses: {
                        orderBy: { createdAt: 'desc' },
                        take: 1,
                        select: { status: true }
                    }
                }
            });
            if (!order) {
                throw new errorHandler_1.AppError('Заказ не найден', 404);
            }
            if (order.courierId !== courierId) {
                logger_1.logger.warn(`Курьер ${courierId} пытался изменить статус заказа ${orderId}, который ему не назначен`);
                throw new errorHandler_1.AppError('Заказ не назначен вам', 403);
            }
            const currentStatus = (_a = order.statuses[0]) === null || _a === void 0 ? void 0 : _a.status;
            // Курьер может менять статус только на "DELIVERED" и только если заказ в статусе "DELIVERING"
            if (currentStatus !== 'DELIVERING') {
                throw new errorHandler_1.AppError('Можно отметить доставленным только заказ в статусе "DELIVERING"', 400);
            }
            // Создаем новый статус
            yield prisma_1.default.orderStatus.create({
                data: {
                    orderId,
                    status: 'DELIVERED'
                }
            });
            // Инвалидируем кэш
            cache_1.cacheService.invalidatePattern(`courier:${courierId}:*`);
            cache_1.cacheService.invalidatePattern(`*order*:${orderId}*`);
            cache_1.cacheService.invalidatePattern('admin:orders:*');
            // Получаем обновленный заказ
            const updatedOrder = yield orderService.getOrderById(orderId, undefined, false);
            logger_1.logger.info(`Курьер ${courierId} отметил заказ ${orderId} как доставленный`);
            apiResponse_1.ApiResponseUtil.success(res, updatedOrder, 'Заказ отмечен как доставленный');
        }
        catch (error) {
            next(error);
        }
    })
];
// Назначить курьера на заказ (только для админов)
exports.assignCourierToOrder = [
    (0, zodValidation_1.validateBody)(schemas_1.assignCourierSchema),
    (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
        var _a;
        try {
            const { orderId, courierId } = req.body;
            // Проверяем существование заказа
            const order = yield prisma_1.default.order.findUnique({
                where: { id: orderId },
                select: { id: true, courierId: true }
            });
            if (!order) {
                throw new errorHandler_1.AppError('Заказ не найден', 404);
            }
            // Проверяем, что пользователь является курьером
            const courier = yield prisma_1.default.user.findUnique({
                where: { id: courierId },
                select: { id: true, role: true, name: true, phone_number: true }
            });
            if (!courier) {
                throw new errorHandler_1.AppError('Курьер не найден', 404);
            }
            if (courier.role !== 'COURIER') {
                throw new errorHandler_1.AppError('Указанный пользователь не является курьером', 400);
            }
            // Проверяем, что заказ не назначен другому курьеру
            if (order.courierId && order.courierId !== courierId) {
                throw new errorHandler_1.AppError('Заказ уже назначен другому курьеру', 400);
            }
            // Транзакция для назначения курьера и обновления статуса
            const result = yield prisma_1.default.$transaction((tx) => __awaiter(void 0, void 0, void 0, function* () {
                // Назначаем курьера
                const updatedOrder = yield tx.order.update({
                    where: { id: orderId },
                    data: { courierId }
                });
                // Создаем новый статус "DELIVERING"
                yield tx.orderStatus.create({
                    data: {
                        orderId,
                        status: 'DELIVERING'
                    }
                });
                // Получаем полный заказ с обновленными данными
                return yield tx.order.findUnique({
                    where: { id: orderId },
                    include: {
                        courier: {
                            select: { id: true, name: true, phone_number: true, telegram_user_id: true }
                        },
                        items: {
                            include: {
                                product: {
                                    select: { id: true, name: true, price: true, image: true }
                                }
                            }
                        },
                        user: {
                            select: {
                                id: true,
                                telegram_user_id: true,
                                name: true,
                                phone_number: true
                            }
                        },
                        statuses: {
                            orderBy: { createdAt: 'desc' },
                            select: { id: true, status: true, createdAt: true },
                            take: 1
                        }
                    }
                });
            }));
            // Инвалидируем кэш
            cache_1.cacheService.invalidatePattern(`courier:${courierId}:*`);
            cache_1.cacheService.invalidatePattern(`*order*:${orderId}*`);
            cache_1.cacheService.invalidatePattern('admin:orders:*');
            // Отправляем уведомление курьеру асинхронно
            setImmediate(() => __awaiter(void 0, void 0, void 0, function* () {
                try {
                    yield telegramService_1.telegramService.sendCourierAssignmentNotification(orderId, courierId);
                }
                catch (error) {
                    console.error('Ошибка отправки уведомления курьеру:', error);
                }
            }));
            logger_1.logger.info(`Админ ${req.user.id} назначил курьера ${courierId} на заказ ${orderId}`);
            apiResponse_1.ApiResponseUtil.success(res, Object.assign(Object.assign({}, result), { totalAmount: result.items.reduce((sum, item) => sum + (item.price || 0) * item.quantity, 0), currentStatus: ((_a = result.statuses[0]) === null || _a === void 0 ? void 0 : _a.status) || 'DELIVERING' }), 'Курьер успешно назначен на заказ');
        }
        catch (error) {
            next(error);
        }
    })
];
// Получить список всех курьеров (для админов)
exports.getCouriers = [
    (0, zodValidation_1.validateQuery)(schemas_1.paginationSchema.extend({
        search: zod_1.z.string().optional()
    })),
    (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
        try {
            const { page, limit, sortBy, sortOrder, search } = req.validatedQuery;
            const cacheKey = cache_1.CacheService.generatePaginationKey('admin:couriers', page, limit, { search, sortBy, sortOrder });
            const result = yield cache_1.cacheService.memoize(cacheKey, () => __awaiter(void 0, void 0, void 0, function* () {
                const whereClause = { role: 'COURIER' };
                if (search) {
                    whereClause.OR = [
                        { name: { contains: search, mode: 'insensitive' } },
                        { phone_number: { contains: search } }
                    ];
                }
                const skip = (page - 1) * limit;
                const total = yield prisma_1.default.user.count({ where: whereClause });
                const couriers = yield prisma_1.default.user.findMany({
                    where: whereClause,
                    skip,
                    take: limit,
                    orderBy: { [sortBy]: sortOrder },
                    select: {
                        id: true,
                        name: true,
                        phone_number: true,
                        telegram_user_id: true
                    }
                });
                // Добавляем статистику для каждого курьера
                const couriersWithStats = yield Promise.all(couriers.map((courier) => __awaiter(void 0, void 0, void 0, function* () {
                    const activeOrders = yield prisma_1.default.order.count({
                        where: {
                            courierId: courier.id,
                            statuses: {
                                some: {
                                    status: {
                                        in: ['CONFIRMED', 'PREPARING', 'READY', 'DELIVERING']
                                    }
                                }
                            }
                        }
                    });
                    const deliveredOrders = yield prisma_1.default.order.count({
                        where: {
                            courierId: courier.id,
                            statuses: {
                                some: {
                                    status: 'DELIVERED'
                                }
                            }
                        }
                    });
                    return Object.assign(Object.assign({}, courier), { activeOrders, totalDelivered: deliveredOrders });
                })));
                return {
                    data: couriersWithStats,
                    meta: {
                        page,
                        limit,
                        total,
                        totalPages: Math.ceil(total / limit)
                    }
                };
            }), 5 * 60 * 1000 // 5 минут кэш
            );
            apiResponse_1.ApiResponseUtil.paginated(res, result.data, result.meta);
        }
        catch (error) {
            next(error);
        }
    })
];
// Получить статистику курьера
const getCourierStats = (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const courierId = req.user.id;
        const cacheKey = `courier:${courierId}:stats`;
        const stats = yield cache_1.cacheService.memoize(cacheKey, () => __awaiter(void 0, void 0, void 0, function* () {
            // Подсчитываем заказы по статусам
            const totalOrders = yield prisma_1.default.order.count({
                where: { courierId }
            });
            const deliveredOrders = yield prisma_1.default.order.count({
                where: {
                    courierId,
                    statuses: {
                        some: { status: 'DELIVERED' }
                    }
                }
            });
            const activeOrders = yield prisma_1.default.order.count({
                where: {
                    courierId,
                    statuses: {
                        some: {
                            status: {
                                in: ['CONFIRMED', 'PREPARING', 'READY', 'DELIVERING']
                            }
                        }
                    }
                }
            });
            // Статистика за текущий месяц
            const startOfMonth = new Date();
            startOfMonth.setDate(1);
            startOfMonth.setHours(0, 0, 0, 0);
            const monthlyDelivered = yield prisma_1.default.order.count({
                where: {
                    courierId,
                    statuses: {
                        some: {
                            status: 'DELIVERED',
                            createdAt: {
                                gte: startOfMonth
                            }
                        }
                    }
                }
            });
            // Рейтинг выполнения (процент доставленных от общего количества назначенных)
            const deliveryRate = totalOrders > 0 ? (deliveredOrders / totalOrders * 100).toFixed(1) : '0';
            return {
                totalOrders,
                deliveredOrders,
                activeOrders,
                monthlyDelivered,
                deliveryRate: parseFloat(deliveryRate),
                efficiency: deliveredOrders > 0 ? 'Хорошая' : 'Новый курьер'
            };
        }), 10 * 60 * 1000 // 10 минут кэш
        );
        apiResponse_1.ApiResponseUtil.success(res, stats);
    }
    catch (error) {
        next(error);
    }
});
exports.getCourierStats = getCourierStats;
// Получить статистику курьера по ID (для админов)
exports.getCourierStatsById = [
    (0, zodValidation_1.validateParams)(schemas_1.idSchema),
    (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
        try {
            const { id: courierId } = req.validatedParams;
            // Проверяем, что пользователь является курьером
            const courier = yield prisma_1.default.user.findUnique({
                where: { id: courierId },
                select: {
                    id: true,
                    role: true,
                    name: true,
                    phone_number: true,
                    telegram_user_id: true
                }
            });
            if (!courier) {
                throw new errorHandler_1.AppError('Курьер не найден', 404);
            }
            if (courier.role !== 'COURIER') {
                throw new errorHandler_1.AppError('Указанный пользователь не является курьером', 400);
            }
            const cacheKey = `admin:courier:${courierId}:stats`;
            const stats = yield cache_1.cacheService.memoize(cacheKey, () => __awaiter(void 0, void 0, void 0, function* () {
                // Подсчитываем заказы по статусам
                const totalOrders = yield prisma_1.default.order.count({
                    where: { courierId }
                });
                const deliveredOrders = yield prisma_1.default.order.count({
                    where: {
                        courierId,
                        statuses: {
                            some: { status: 'DELIVERED' }
                        }
                    }
                });
                const activeOrders = yield prisma_1.default.order.count({
                    where: {
                        courierId,
                        statuses: {
                            some: {
                                status: {
                                    in: ['CONFIRMED', 'PREPARING', 'READY', 'DELIVERING']
                                }
                            }
                        }
                    }
                });
                const cancelledOrders = yield prisma_1.default.order.count({
                    where: {
                        courierId,
                        statuses: {
                            some: { status: 'CANCELLED' }
                        }
                    }
                });
                // Статистика за текущий месяц
                const startOfMonth = new Date();
                startOfMonth.setDate(1);
                startOfMonth.setHours(0, 0, 0, 0);
                const monthlyDelivered = yield prisma_1.default.order.count({
                    where: {
                        courierId,
                        statuses: {
                            some: {
                                status: 'DELIVERED',
                                createdAt: {
                                    gte: startOfMonth
                                }
                            }
                        }
                    }
                });
                // Последний доставленный заказ
                const lastDelivery = yield prisma_1.default.orderStatus.findFirst({
                    where: {
                        status: 'DELIVERED',
                        order: {
                            courierId: courierId
                        }
                    },
                    orderBy: { createdAt: 'desc' }
                });
                // Рейтинг выполнения
                const deliveryRateNum = totalOrders > 0 ? (deliveredOrders / totalOrders * 100) : 0;
                const deliveryRate = deliveryRateNum.toFixed(1);
                // Определяем эффективность
                let efficiency = 'Новый курьер';
                if (deliveredOrders >= 50)
                    efficiency = 'Отличная';
                else if (deliveredOrders >= 20)
                    efficiency = 'Хорошая';
                else if (deliveredOrders >= 5)
                    efficiency = 'Средняя';
                return {
                    totalOrders,
                    deliveredOrders,
                    activeOrders,
                    cancelledOrders,
                    monthlyStats: {
                        delivered: monthlyDelivered,
                        earnings: monthlyDelivered * 500 // Примерный заработок
                    },
                    averageDeliveryTime: 45.5,
                    rating: Math.min(4.8, 3.5 + (deliveryRateNum / 25)),
                    efficiency,
                    deliveryRate: parseFloat(deliveryRate),
                    lastDelivery: (lastDelivery === null || lastDelivery === void 0 ? void 0 : lastDelivery.createdAt) || null
                };
            }), 10 * 60 * 1000 // 10 минут кэш
            );
            apiResponse_1.ApiResponseUtil.success(res, {
                courier: {
                    id: courier.id,
                    telegram_user_id: courier.telegram_user_id,
                    name: courier.name,
                    phone: courier.phone_number
                },
                stats
            });
        }
        catch (error) {
            next(error);
        }
    })
];
// Получить детали заказа для курьера
exports.getCourierOrder = [
    (0, zodValidation_1.validateParams)(schemas_1.idSchema),
    (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
        try {
            const { id: orderId } = req.validatedParams;
            const courierId = req.user.id;
            const cacheKey = `courier:${courierId}:order:${orderId}`;
            const order = yield cache_1.cacheService.memoize(cacheKey, () => __awaiter(void 0, void 0, void 0, function* () {
                var _a;
                const order = yield prisma_1.default.order.findUnique({
                    where: {
                        id: orderId,
                        courierId // Курьер может видеть только свои заказы
                    },
                    include: {
                        items: {
                            include: {
                                product: {
                                    select: { id: true, name: true, price: true, image: true }
                                }
                            }
                        },
                        user: {
                            select: {
                                id: true,
                                telegram_user_id: true,
                                name: true,
                                phone_number: true
                            }
                        },
                        statuses: {
                            orderBy: { createdAt: 'asc' },
                            select: { id: true, status: true, createdAt: true }
                        }
                    }
                });
                if (!order) {
                    throw new errorHandler_1.AppError('Заказ не найден или не назначен вам', 404);
                }
                return Object.assign(Object.assign({}, order), { totalAmount: order.items.reduce((sum, item) => sum + (item.price || 0) * item.quantity, 0), currentStatus: ((_a = order.statuses[order.statuses.length - 1]) === null || _a === void 0 ? void 0 : _a.status) || 'NEW' });
            }), 5 * 60 * 1000 // 5 минут кэш
            );
            apiResponse_1.ApiResponseUtil.success(res, order);
        }
        catch (error) {
            next(error);
        }
    })
];
