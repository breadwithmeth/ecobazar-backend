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
exports.getCourierStats = exports.getCouriers = exports.assignCourierToOrder = exports.updateOrderStatusByCourier = exports.getCourierOrders = void 0;
const errorHandler_1 = require("../middlewares/errorHandler");
const apiResponse_1 = require("../utils/apiResponse");
const pagination_1 = require("../utils/pagination");
const prisma_1 = __importDefault(require("../lib/prisma"));
// Получить заказы курьера
const getCourierOrders = (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { page, limit, sortBy, sortOrder } = pagination_1.PaginationUtil.parseQuery(req.query);
        const { skip, take } = pagination_1.PaginationUtil.getSkipTake(page, limit);
        const statusFilter = req.query.status;
        const whereClause = {
            courierId: req.user.id
        };
        if (statusFilter) {
            whereClause.statuses = {
                some: {
                    status: statusFilter
                }
            };
        }
        const total = yield prisma_1.default.order.count({ where: whereClause });
        const orders = yield prisma_1.default.order.findMany({
            where: whereClause,
            skip,
            take,
            orderBy: pagination_1.PaginationUtil.buildOrderBy(sortBy || 'createdAt', sortOrder || 'desc'),
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
        // Добавляем текущий статус
        const ordersWithStatus = orders.map(order => {
            var _a;
            return (Object.assign(Object.assign({}, order), { currentStatus: ((_a = order.statuses[0]) === null || _a === void 0 ? void 0 : _a.status) || 'NEW', totalAmount: order.items.reduce((sum, item) => sum + (item.price || 0) * item.quantity, 0) }));
        });
        const meta = pagination_1.PaginationUtil.buildMeta(total, page, limit);
        apiResponse_1.ApiResponseUtil.success(res, { orders: ordersWithStatus, meta });
    }
    catch (error) {
        next(error);
    }
});
exports.getCourierOrders = getCourierOrders;
// Обновить статус заказа курьером
const updateOrderStatusByCourier = (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    var _a;
    try {
        const orderId = parseInt(req.params.id);
        const { status } = req.body;
        if (!orderId) {
            throw new errorHandler_1.AppError('ID заказа обязателен', 400);
        }
        // Проверяем, что заказ назначен этому курьеру
        const order = yield prisma_1.default.order.findUnique({
            where: { id: orderId },
            select: {
                id: true,
                courierId: true,
                statuses: {
                    orderBy: { createdAt: 'desc' },
                    take: 1
                }
            }
        });
        if (!order) {
            throw new errorHandler_1.AppError('Заказ не найден', 404);
        }
        if (order.courierId !== req.user.id) {
            throw new errorHandler_1.AppError('Заказ не назначен вам', 403);
        }
        const currentStatus = (_a = order.statuses[0]) === null || _a === void 0 ? void 0 : _a.status;
        // Курьер может менять статус только на "DELIVERED" и только если заказ в статусе "DELIVERING"
        if (status !== 'DELIVERED') {
            throw new errorHandler_1.AppError('Курьер может изменить статус только на "DELIVERED"', 400);
        }
        if (currentStatus !== 'DELIVERING') {
            throw new errorHandler_1.AppError('Можно отметить доставленным только заказ в статусе "DELIVERING"', 400);
        }
        // Создаем новый статус
        yield prisma_1.default.orderStatus.create({
            data: {
                orderId,
                status
            }
        });
        // Получаем обновленный заказ
        const updatedOrder = yield prisma_1.default.order.findUnique({
            where: { id: orderId },
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
                    select: { id: true, status: true, createdAt: true }
                }
            }
        });
        apiResponse_1.ApiResponseUtil.success(res, updatedOrder, 'Статус заказа успешно обновлен');
    }
    catch (error) {
        next(error);
    }
});
exports.updateOrderStatusByCourier = updateOrderStatusByCourier;
// Назначить курьера на заказ (только для админов)
const assignCourierToOrder = (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { orderId, courierId } = req.body;
        if (!orderId || !courierId) {
            throw new errorHandler_1.AppError('orderId и courierId обязательны', 400);
        }
        // Проверяем существование заказа
        const order = yield prisma_1.default.order.findUnique({
            where: { id: orderId },
            select: { id: true, courierId: true }
        });
        if (!order) {
            throw new errorHandler_1.AppError('Заказ не найден', 404);
        }
        // Проверяем существование курьера
        const courier = yield prisma_1.default.user.findUnique({
            where: { id: courierId },
            select: { id: true, role: true, name: true }
        });
        if (!courier) {
            throw new errorHandler_1.AppError('Курьер не найден', 404);
        }
        if (courier.role !== 'COURIER') {
            throw new errorHandler_1.AppError('Указанный пользователь не является курьером', 400);
        }
        // Назначаем курьера
        const updatedOrder = yield prisma_1.default.order.update({
            where: { id: orderId },
            data: { courierId },
            include: {
                courier: {
                    select: { id: true, name: true, phone_number: true }
                },
                items: {
                    include: {
                        product: {
                            select: { id: true, name: true, price: true }
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
                }
            }
        });
        apiResponse_1.ApiResponseUtil.success(res, updatedOrder, 'Курьер успешно назначен на заказ');
    }
    catch (error) {
        next(error);
    }
});
exports.assignCourierToOrder = assignCourierToOrder;
// Получить список всех курьеров (для админов)
const getCouriers = (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { page, limit } = pagination_1.PaginationUtil.parseQuery(req.query);
        const { skip, take } = pagination_1.PaginationUtil.getSkipTake(page, limit);
        const total = yield prisma_1.default.user.count({
            where: { role: 'COURIER' }
        });
        const couriers = yield prisma_1.default.user.findMany({
            where: { role: 'COURIER' },
            skip,
            take,
            select: {
                id: true,
                name: true,
                phone_number: true,
                telegram_user_id: true,
                _count: {
                    select: {
                        deliveredOrders: true
                    }
                }
            },
            orderBy: { name: 'asc' }
        });
        const meta = pagination_1.PaginationUtil.buildMeta(total, page, limit);
        apiResponse_1.ApiResponseUtil.success(res, { couriers, meta });
    }
    catch (error) {
        next(error);
    }
});
exports.getCouriers = getCouriers;
// Получить статистику курьера
const getCourierStats = (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const courierId = req.user.id;
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
        const stats = {
            totalOrders,
            deliveredOrders,
            activeOrders,
            deliveryRate: totalOrders > 0 ? Math.round((deliveredOrders / totalOrders) * 100) : 0
        };
        apiResponse_1.ApiResponseUtil.success(res, stats);
    }
    catch (error) {
        next(error);
    }
});
exports.getCourierStats = getCourierStats;
