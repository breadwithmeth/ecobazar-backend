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
exports.getOrder = exports.getOrders = exports.createOrder = exports.getAllOrders = void 0;
const prisma_1 = __importDefault(require("../lib/prisma"));
const errorHandler_1 = require("../middlewares/errorHandler");
const apiResponse_1 = require("../utils/apiResponse");
const telegramService_1 = require("../services/telegramService");
// Получить все заказы (только для ADMIN)
const getAllOrders = (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { page, limit, sortBy, sortOrder } = apiResponse_1.PaginationUtil.parseQuery(req.query);
        const { skip, take } = apiResponse_1.PaginationUtil.getSkipTake(page, limit);
        // Фильтрация по статусу
        const statusFilter = req.query.status;
        const whereClause = {};
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
            orderBy: apiResponse_1.PaginationUtil.buildOrderBy(sortBy || 'createdAt', sortOrder || 'desc'), // Сортировка: новые заказы первыми
            include: {
                items: {
                    include: {
                        product: {
                            select: { id: true, name: true, price: true, image: true }
                        },
                        storeConfirmation: {
                            select: {
                                id: true,
                                status: true,
                                confirmedQuantity: true,
                                confirmedAt: true,
                                notes: true,
                                store: {
                                    select: { id: true, name: true }
                                },
                                confirmedBy: {
                                    select: { id: true, name: true }
                                }
                            }
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
                courier: {
                    select: {
                        id: true,
                        name: true,
                        telegram_user_id: true,
                        phone_number: true
                    }
                },
                statuses: {
                    orderBy: { createdAt: 'desc' },
                    select: { id: true, status: true, createdAt: true }
                }
            }
        });
        // Добавляем общую сумму и текущий статус к каждому заказу
        const ordersWithDetails = orders.map((order) => {
            var _a;
            const totalAmount = order.items.reduce((sum, item) => sum + (item.quantity * (item.price || 0)), 0);
            // Подсчитываем статистику подтверждений
            const confirmationStats = {
                pending: 0,
                confirmed: 0,
                partial: 0,
                rejected: 0,
                total: order.items.length
            };
            order.items.forEach((item) => {
                if (item.storeConfirmation) {
                    switch (item.storeConfirmation.status) {
                        case 'PENDING':
                            confirmationStats.pending++;
                            break;
                        case 'CONFIRMED':
                            confirmationStats.confirmed++;
                            break;
                        case 'PARTIAL':
                            confirmationStats.partial++;
                            break;
                        case 'REJECTED':
                            confirmationStats.rejected++;
                            break;
                    }
                }
                else {
                    confirmationStats.pending++;
                }
            });
            return Object.assign(Object.assign({}, order), { deliveryType: order.deliveryType, scheduledDate: order.scheduledDate, totalAmount, currentStatus: ((_a = order.statuses[0]) === null || _a === void 0 ? void 0 : _a.status) || null, itemsCount: order.items.length, confirmationStats });
        });
        apiResponse_1.ApiResponseUtil.paginated(res, ordersWithDetails, {
            page: page || 1,
            limit: limit || 10,
            total
        });
    }
    catch (error) {
        next(error);
    }
});
exports.getAllOrders = getAllOrders;
const createOrder = (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { items, address, deliveryType = 'ASAP', scheduledDate } = req.body;
        const userId = req.user.id;
        // Дополнительная валидация для запланированной доставки
        if (deliveryType === 'SCHEDULED' && !scheduledDate) {
            throw new errorHandler_1.AppError('При выборе запланированной доставки необходимо указать дату и время', 400);
        }
        // Проверяем все товары и их наличие
        const productIds = items.map((item) => item.productId);
        const products = yield prisma_1.default.product.findMany({
            where: { id: { in: productIds } },
            select: { id: true, name: true, price: true }
        });
        if (products.length !== productIds.length) {
            throw new errorHandler_1.AppError('Некоторые товары не найдены', 400);
        }
        // Проверяем остатки товаров
        const movements = yield prisma_1.default.stockMovement.findMany({
            where: { productId: { in: productIds } },
            select: { productId: true, type: true, quantity: true }
        });
        const stockMap = new Map();
        for (const movement of movements) {
            const current = stockMap.get(movement.productId) || 0;
            const change = movement.type === 'INCOME' ? movement.quantity : -movement.quantity;
            stockMap.set(movement.productId, current + change);
        }
        // Проверяем, что всех товаров достаточно
        for (const item of items) {
            const availableStock = stockMap.get(item.productId) || 0;
            if (availableStock < item.quantity) {
                const product = products.find(p => p.id === item.productId);
                throw new errorHandler_1.AppError(`Недостаточно товара "${product === null || product === void 0 ? void 0 : product.name}" на складе. Доступно: ${availableStock}`, 400);
            }
        }
        // Создаем заказ в транзакции с увеличенным таймаутом
        const result = yield prisma_1.default.$transaction((tx) => __awaiter(void 0, void 0, void 0, function* () {
            // Создаем заказ
            const order = yield tx.order.create({
                data: {
                    userId,
                    address: address.trim(),
                    deliveryType,
                    scheduledDate: deliveryType === 'SCHEDULED' ? scheduledDate : null,
                    items: {
                        create: items.map((item) => {
                            const product = products.find(p => p.id === item.productId);
                            return {
                                productId: item.productId,
                                quantity: item.quantity,
                                price: product.price // Фиксируем цену на момент заказа
                            };
                        })
                    }
                },
                include: {
                    items: {
                        include: {
                            product: {
                                select: { id: true, name: true, image: true }
                            }
                        }
                    }
                }
            });
            // Создаем начальный статус заказа
            yield tx.orderStatus.create({
                data: {
                    orderId: order.id,
                    status: 'NEW'
                }
            });
            // Создаем записи для подтверждения магазинами и списываем товары параллельно
            const [productsWithStores] = yield Promise.all([
                tx.product.findMany({
                    where: { id: { in: items.map((item) => item.productId) } },
                    select: { id: true, storeId: true }
                })
            ]);
            // Создаем подтверждения и движения склада параллельно
            yield Promise.all([
                // Создаем записи для подтверждения магазинами
                ...order.items.map((orderItem) => __awaiter(void 0, void 0, void 0, function* () {
                    const product = productsWithStores.find(p => p.id === orderItem.productId);
                    if (product) {
                        return tx.storeOrderConfirmation.create({
                            data: {
                                orderItemId: orderItem.id,
                                storeId: product.storeId,
                                status: 'PENDING'
                            }
                        });
                    }
                })),
                // Списываем товары со склада
                ...items.map((item) => tx.stockMovement.create({
                    data: {
                        productId: item.productId,
                        quantity: item.quantity,
                        type: 'OUTCOME',
                        adminId: userId // Записываем, кто сделал заказ
                    }
                }))
            ]);
            return order;
        }), {
            timeout: 15000 // Увеличиваем таймаут до 15 секунд
        });
        // Добавляем общую сумму заказа
        const orderWithTotal = Object.assign(Object.assign({}, result), { totalAmount: result.items.reduce((sum, item) => sum + (item.quantity * (item.price || 0)), 0), status: 'NEW' });
        // Отправляем Telegram уведомления продавцам асинхронно
        setImmediate(() => __awaiter(void 0, void 0, void 0, function* () {
            try {
                yield telegramService_1.telegramService.sendNewOrderNotifications(result.id);
            }
            catch (error) {
                console.error('Ошибка отправки Telegram уведомлений:', error);
            }
        }));
        apiResponse_1.ApiResponseUtil.created(res, orderWithTotal, 'Заказ успешно создан');
    }
    catch (error) {
        next(error);
    }
});
exports.createOrder = createOrder;
const getOrders = (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const userId = req.user.id;
        const { page, limit } = apiResponse_1.PaginationUtil.parseQuery(req.query);
        const { skip, take } = apiResponse_1.PaginationUtil.getSkipTake(page, limit);
        // Получаем заказы пользователя, исключая доставленные
        const whereClause = {
            userId,
            statuses: {
                every: {
                    status: { not: 'DELIVERED' }
                }
            }
        };
        const total = yield prisma_1.default.order.count({ where: whereClause });
        const orders = yield prisma_1.default.order.findMany({
            where: whereClause,
            skip,
            take,
            orderBy: { createdAt: 'desc' }, // Новые заказы первыми
            include: {
                items: {
                    include: {
                        product: {
                            select: { id: true, name: true, price: true, image: true }
                        }
                    }
                },
                statuses: {
                    orderBy: { createdAt: 'desc' },
                    take: 1,
                    select: { status: true, createdAt: true }
                }
            }
        });
        // Для каждого заказа возвращаем только последний статус и общую сумму
        const result = orders.map(order => {
            var _a, _b;
            return ({
                id: order.id,
                address: order.address,
                createdAt: order.createdAt,
                deliveryType: order.deliveryType,
                scheduledDate: order.scheduledDate,
                items: order.items,
                totalAmount: order.items.reduce((sum, item) => sum + (item.quantity * (item.price || 0)), 0),
                status: ((_a = order.statuses[0]) === null || _a === void 0 ? void 0 : _a.status) || null,
                statusUpdatedAt: ((_b = order.statuses[0]) === null || _b === void 0 ? void 0 : _b.createdAt) || order.createdAt,
                itemsCount: order.items.length
            });
        });
        apiResponse_1.ApiResponseUtil.paginated(res, result, {
            page: page || 1,
            limit: limit || 10,
            total
        });
    }
    catch (error) {
        next(error);
    }
});
exports.getOrders = getOrders;
const getOrder = (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    var _a;
    try {
        const { id } = req.params;
        const orderId = parseInt(id);
        const userId = req.user.id;
        const isAdmin = req.user.role === 'ADMIN';
        if (isNaN(orderId)) {
            throw new errorHandler_1.AppError('Неверный ID заказа', 400);
        }
        const whereClause = { id: orderId };
        // Обычные пользователи могут видеть только свои заказы
        if (!isAdmin) {
            whereClause.userId = userId;
        }
        const order = yield prisma_1.default.order.findUnique({
            where: whereClause,
            include: {
                items: {
                    include: {
                        product: {
                            select: { id: true, name: true, price: true, image: true }
                        },
                        storeConfirmation: isAdmin ? {
                            select: {
                                id: true,
                                status: true,
                                confirmedQuantity: true,
                                confirmedAt: true,
                                notes: true,
                                store: {
                                    select: { id: true, name: true }
                                },
                                confirmedBy: {
                                    select: { id: true, name: true }
                                }
                            }
                        } : undefined
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
        // Добавляем информацию о подтверждениях для админов
        let confirmationStats;
        if (isAdmin && order.items) {
            confirmationStats = {
                pending: 0,
                confirmed: 0,
                partial: 0,
                rejected: 0,
                total: order.items.length
            };
            order.items.forEach((item) => {
                if (item.storeConfirmation) {
                    switch (item.storeConfirmation.status) {
                        case 'PENDING':
                            confirmationStats.pending++;
                            break;
                        case 'CONFIRMED':
                            confirmationStats.confirmed++;
                            break;
                        case 'PARTIAL':
                            confirmationStats.partial++;
                            break;
                        case 'REJECTED':
                            confirmationStats.rejected++;
                            break;
                    }
                }
                else {
                    confirmationStats.pending++;
                }
            });
        }
        const orderWithDetails = Object.assign(Object.assign(Object.assign({}, order), { deliveryType: order.deliveryType, scheduledDate: order.scheduledDate, totalAmount: order.items.reduce((sum, item) => sum + (item.quantity * (item.price || 0)), 0), currentStatus: ((_a = order.statuses[order.statuses.length - 1]) === null || _a === void 0 ? void 0 : _a.status) || null, itemsCount: order.items.length }), (isAdmin && confirmationStats ? { confirmationStats } : {}));
        apiResponse_1.ApiResponseUtil.success(res, orderWithDetails);
    }
    catch (error) {
        next(error);
    }
});
exports.getOrder = getOrder;
