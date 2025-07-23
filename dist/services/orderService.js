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
exports.OrderService = void 0;
const prisma_1 = __importDefault(require("../lib/prisma"));
const errorHandler_1 = require("../middlewares/errorHandler");
const types_1 = require("../types");
const apiResponse_1 = require("../utils/apiResponse");
const telegramService_1 = require("./telegramService");
class OrderService {
    createOrder(userId, data) {
        return __awaiter(this, void 0, void 0, function* () {
            // Проверяем все товары и их наличие
            const productIds = data.items.map(item => item.productId);
            const products = yield prisma_1.default.product.findMany({
                where: { id: { in: productIds } },
                select: { id: true, name: true, price: true }
            });
            if (products.length !== productIds.length) {
                throw new errorHandler_1.AppError('Некоторые товары не найдены', 400);
            }
            // Проверяем остатки товаров
            const stockPromises = productIds.map((productId) => __awaiter(this, void 0, void 0, function* () {
                var _a, _b;
                const movements = yield prisma_1.default.stockMovement.findMany({
                    where: { productId },
                    select: { quantity: true, type: true }
                });
                const stock = movements.reduce((sum, movement) => {
                    return movement.type === 'INCOME'
                        ? sum + movement.quantity
                        : sum - movement.quantity;
                }, 0);
                const requiredQuantity = ((_a = data.items.find(item => item.productId === productId)) === null || _a === void 0 ? void 0 : _a.quantity) || 0;
                if (stock < requiredQuantity) {
                    throw new errorHandler_1.AppError(`Недостаточно товара на складе: ${(_b = products.find(p => p.id === productId)) === null || _b === void 0 ? void 0 : _b.name}`, 400);
                }
                return { productId, stock };
            }));
            yield Promise.all(stockPromises);
            // Создаем заказ в транзакции
            const order = yield prisma_1.default.$transaction((tx) => __awaiter(this, void 0, void 0, function* () {
                // Создаем заказ
                const newOrder = yield tx.order.create({
                    data: {
                        userId,
                        address: data.address.trim()
                    }
                });
                // Создаем элементы заказа
                const orderItems = yield Promise.all(data.items.map((item) => __awaiter(this, void 0, void 0, function* () {
                    const product = products.find(p => p.id === item.productId);
                    return tx.orderItem.create({
                        data: {
                            orderId: newOrder.id,
                            productId: item.productId,
                            quantity: item.quantity,
                            price: item.price || product.price
                        }
                    });
                })));
                // Создаем записи для подтверждения магазинами
                const productsWithStores = yield tx.product.findMany({
                    where: { id: { in: productIds } },
                    select: { id: true, storeId: true }
                });
                yield Promise.all(orderItems.map((orderItem) => __awaiter(this, void 0, void 0, function* () {
                    const product = productsWithStores.find(p => p.id === orderItem.productId);
                    if (product) {
                        yield tx.storeOrderConfirmation.create({
                            data: {
                                orderItemId: orderItem.id,
                                storeId: product.storeId,
                                status: 'PENDING'
                            }
                        });
                    }
                })));
                // Создаем начальный статус
                yield tx.orderStatus.create({
                    data: {
                        orderId: newOrder.id,
                        status: types_1.OrderStatus.NEW
                    }
                });
                // Списываем товары со склада
                yield Promise.all(data.items.map(item => tx.stockMovement.create({
                    data: {
                        productId: item.productId,
                        quantity: item.quantity,
                        type: 'OUTCOME',
                        adminId: userId // В реальном приложении нужно передавать админа
                    }
                })));
                return Object.assign(Object.assign({}, newOrder), { items: orderItems });
            }), {
                timeout: 15000 // Увеличиваем таймаут до 15 секунд
            });
            // Отправляем Telegram уведомления продавцам асинхронно
            setImmediate(() => __awaiter(this, void 0, void 0, function* () {
                try {
                    yield telegramService_1.telegramService.sendNewOrderNotifications(order.id);
                }
                catch (error) {
                    console.error('Ошибка отправки Telegram уведомлений:', error);
                }
            }));
            return this.getOrderById(order.id, userId, false);
        });
    }
    getOrders(pagination_1, userId_1) {
        return __awaiter(this, arguments, void 0, function* (pagination, userId, filters = {}, isAdmin = false) {
            const { skip, take } = apiResponse_1.PaginationUtil.getSkipTake(pagination.page, pagination.limit);
            const whereClause = {};
            // Обычные пользователи видят только свои заказы
            if (!isAdmin && userId) {
                whereClause.userId = userId;
            }
            // Фильтр по пользователю для админов
            if (isAdmin && filters.userId) {
                whereClause.userId = filters.userId;
            }
            // Фильтр по статусу
            if (filters.status) {
                whereClause.statuses = {
                    some: { status: filters.status }
                };
            }
            // Фильтр по дате
            if (filters.dateFrom) {
                whereClause.createdAt = {
                    gte: filters.dateFrom
                };
            }
            if (filters.dateTo) {
                whereClause.createdAt = Object.assign(Object.assign({}, whereClause.createdAt), { lte: filters.dateTo });
            }
            const orderBy = apiResponse_1.PaginationUtil.buildOrderBy(pagination.sortBy, pagination.sortOrder);
            const [orders, total] = yield Promise.all([
                prisma_1.default.order.findMany({
                    where: whereClause,
                    include: {
                        items: {
                            include: {
                                product: {
                                    select: { id: true, name: true, price: true, image: true }
                                }
                            }
                        },
                        user: isAdmin ? {
                            select: {
                                id: true,
                                telegram_user_id: true,
                                name: true,
                                phone_number: true
                            }
                        } : undefined,
                        statuses: {
                            orderBy: { createdAt: 'desc' },
                            take: 1,
                            select: { status: true, createdAt: true }
                        }
                    },
                    orderBy,
                    skip,
                    take
                }),
                prisma_1.default.order.count({ where: whereClause })
            ]);
            const ordersWithDetails = orders.map(order => {
                var _a, _b;
                return (Object.assign(Object.assign({}, order), { totalAmount: order.items.reduce((sum, item) => sum + (item.quantity * (item.price || 0)), 0), status: ((_a = order.statuses[0]) === null || _a === void 0 ? void 0 : _a.status) || types_1.OrderStatus.NEW, statusUpdatedAt: ((_b = order.statuses[0]) === null || _b === void 0 ? void 0 : _b.createdAt) || order.createdAt, itemsCount: order.items.length }));
            });
            return {
                data: ordersWithDetails,
                meta: {
                    page: pagination.page,
                    limit: pagination.limit,
                    total,
                    totalPages: Math.ceil(total / pagination.limit)
                }
            };
        });
    }
    getOrderById(orderId_1, userId_1) {
        return __awaiter(this, arguments, void 0, function* (orderId, userId, isAdmin = false) {
            var _a;
            const whereClause = { id: orderId };
            // Обычные пользователи могут видеть только свои заказы
            if (!isAdmin && userId) {
                whereClause.userId = userId;
            }
            const order = yield prisma_1.default.order.findUnique({
                where: whereClause,
                include: {
                    items: {
                        include: {
                            product: {
                                select: { id: true, name: true, price: true, image: true }
                            }
                        }
                    },
                    user: isAdmin ? {
                        select: {
                            id: true,
                            telegram_user_id: true,
                            name: true,
                            phone_number: true
                        }
                    } : undefined,
                    statuses: {
                        orderBy: { createdAt: 'asc' },
                        select: { id: true, status: true, createdAt: true }
                    }
                }
            });
            if (!order) {
                throw new errorHandler_1.AppError('Заказ не найден', 404);
            }
            return Object.assign(Object.assign({}, order), { totalAmount: order.items.reduce((sum, item) => sum + (item.quantity * (item.price || 0)), 0), currentStatus: ((_a = order.statuses[order.statuses.length - 1]) === null || _a === void 0 ? void 0 : _a.status) || types_1.OrderStatus.NEW });
        });
    }
    updateOrderStatus(orderId, status) {
        return __awaiter(this, void 0, void 0, function* () {
            // Проверяем существование заказа
            const order = yield prisma_1.default.order.findUnique({
                where: { id: orderId }
            });
            if (!order) {
                throw new errorHandler_1.AppError('Заказ не найден', 404);
            }
            // Проверяем валидность статуса
            if (!Object.values(types_1.OrderStatus).includes(status)) {
                throw new errorHandler_1.AppError('Неверный статус заказа', 400);
            }
            const orderStatus = yield prisma_1.default.orderStatus.create({
                data: {
                    orderId,
                    status
                }
            });
            // Отправляем Telegram уведомление о смене статуса асинхронно
            setImmediate(() => __awaiter(this, void 0, void 0, function* () {
                try {
                    yield telegramService_1.telegramService.sendOrderStatusUpdate(orderId, status);
                }
                catch (error) {
                    console.error('Ошибка отправки уведомления о статусе заказа:', error);
                }
            }));
            return orderStatus;
        });
    }
    getOrderStatuses(orderId) {
        return __awaiter(this, void 0, void 0, function* () {
            const order = yield prisma_1.default.order.findUnique({
                where: { id: orderId }
            });
            if (!order) {
                throw new errorHandler_1.AppError('Заказ не найден', 404);
            }
            return prisma_1.default.orderStatus.findMany({
                where: { orderId },
                orderBy: { createdAt: 'asc' },
                select: { id: true, status: true, createdAt: true }
            });
        });
    }
}
exports.OrderService = OrderService;
