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
exports.StoreService = void 0;
const prisma_1 = __importDefault(require("../lib/prisma"));
const errorHandler_1 = require("../middlewares/errorHandler");
class StoreService {
    // Получить все магазины с пагинацией
    getStores(pagination_1) {
        return __awaiter(this, arguments, void 0, function* (pagination, filters = {}) {
            const { page = 1, limit = 10, sortBy = 'id', sortOrder = 'asc' } = pagination;
            const { search, ownerId } = filters;
            const skip = (page - 1) * limit;
            const whereClause = {};
            if (search) {
                whereClause.OR = [
                    { name: { contains: search, mode: 'insensitive' } },
                    { address: { contains: search, mode: 'insensitive' } }
                ];
            }
            if (ownerId) {
                whereClause.ownerId = ownerId;
            }
            const [stores, total] = yield Promise.all([
                prisma_1.default.store.findMany({
                    where: whereClause,
                    skip,
                    take: limit,
                    orderBy: { [sortBy]: sortOrder },
                    include: {
                        owner: {
                            select: {
                                id: true,
                                name: true,
                                telegram_user_id: true,
                                phone_number: true,
                                role: true
                            }
                        },
                        products: {
                            take: 5, // Показываем только первые 5 товаров
                            select: {
                                id: true,
                                name: true,
                                price: true,
                                image: true
                            }
                        },
                        _count: {
                            select: {
                                products: true
                            }
                        }
                    }
                }),
                prisma_1.default.store.count({ where: whereClause })
            ]);
            return {
                data: stores,
                meta: {
                    page,
                    limit,
                    total,
                    totalPages: Math.ceil(total / limit)
                }
            };
        });
    }
    // Получить магазин по ID
    getStoreById(storeId) {
        return __awaiter(this, void 0, void 0, function* () {
            const store = yield prisma_1.default.store.findUnique({
                where: { id: storeId },
                include: {
                    owner: {
                        select: {
                            id: true,
                            name: true,
                            telegram_user_id: true,
                            phone_number: true,
                            role: true
                        }
                    },
                    products: {
                        select: {
                            id: true,
                            name: true,
                            price: true,
                            image: true,
                            category: {
                                select: {
                                    id: true,
                                    name: true
                                }
                            }
                        }
                    },
                    _count: {
                        select: {
                            products: true
                        }
                    }
                }
            });
            if (!store) {
                throw new errorHandler_1.AppError('Магазин не найден', 404);
            }
            return store;
        });
    }
    // Получить магазин по владельцу
    getStoreByOwner(ownerId) {
        return __awaiter(this, void 0, void 0, function* () {
            const store = yield prisma_1.default.store.findUnique({
                where: { ownerId },
                include: {
                    products: {
                        select: {
                            id: true,
                            name: true,
                            price: true,
                            image: true,
                            category: {
                                select: {
                                    id: true,
                                    name: true
                                }
                            }
                        }
                    },
                    _count: {
                        select: {
                            products: true
                        }
                    }
                }
            });
            return store;
        });
    }
    // Создать магазин
    createStore(data) {
        return __awaiter(this, void 0, void 0, function* () {
            // Проверяем, что владелец существует и имеет роль SELLER
            if (data.ownerId) {
                const owner = yield prisma_1.default.user.findUnique({
                    where: { id: data.ownerId }
                });
                if (!owner) {
                    throw new errorHandler_1.AppError('Пользователь не найден', 404);
                }
                if (owner.role !== 'SELLER') {
                    throw new errorHandler_1.AppError('Пользователь должен иметь роль SELLER', 400);
                }
                // Проверяем, что у пользователя еще нет магазина
                const existingStore = yield prisma_1.default.store.findUnique({
                    where: { ownerId: data.ownerId }
                });
                if (existingStore) {
                    throw new errorHandler_1.AppError('У этого пользователя уже есть магазин', 400);
                }
            }
            const store = yield prisma_1.default.store.create({
                data: {
                    name: data.name,
                    address: data.address,
                    ownerId: data.ownerId
                },
                include: {
                    owner: {
                        select: {
                            id: true,
                            name: true,
                            telegram_user_id: true,
                            phone_number: true,
                            role: true
                        }
                    }
                }
            });
            return store;
        });
    }
    // Обновить магазин
    updateStore(storeId, data, userId, isAdmin) {
        return __awaiter(this, void 0, void 0, function* () {
            const store = yield prisma_1.default.store.findUnique({
                where: { id: storeId },
                include: { owner: true }
            });
            if (!store) {
                throw new errorHandler_1.AppError('Магазин не найден', 404);
            }
            // Проверяем права доступа
            if (!isAdmin && store.ownerId !== userId) {
                throw new errorHandler_1.AppError('Доступ запрещен', 403);
            }
            const updatedStore = yield prisma_1.default.store.update({
                where: { id: storeId },
                data: Object.assign(Object.assign({}, (data.name && { name: data.name })), (data.address && { address: data.address })),
                include: {
                    owner: {
                        select: {
                            id: true,
                            name: true,
                            telegram_user_id: true,
                            phone_number: true,
                            role: true
                        }
                    }
                }
            });
            return updatedStore;
        });
    }
    // Назначить владельца магазина
    assignOwner(storeId, ownerId) {
        return __awaiter(this, void 0, void 0, function* () {
            const [store, owner] = yield Promise.all([
                prisma_1.default.store.findUnique({ where: { id: storeId } }),
                prisma_1.default.user.findUnique({ where: { id: ownerId } })
            ]);
            if (!store) {
                throw new errorHandler_1.AppError('Магазин не найден', 404);
            }
            if (!owner) {
                throw new errorHandler_1.AppError('Пользователь не найден', 404);
            }
            if (owner.role !== 'SELLER') {
                throw new errorHandler_1.AppError('Пользователь должен иметь роль SELLER', 400);
            }
            // Проверяем, что у пользователя еще нет магазина
            const existingStore = yield prisma_1.default.store.findUnique({
                where: { ownerId }
            });
            if (existingStore && existingStore.id !== storeId) {
                throw new errorHandler_1.AppError('У этого пользователя уже есть другой магазин', 400);
            }
            const updatedStore = yield prisma_1.default.store.update({
                where: { id: storeId },
                data: { ownerId },
                include: {
                    owner: {
                        select: {
                            id: true,
                            name: true,
                            telegram_user_id: true,
                            phone_number: true,
                            role: true
                        }
                    }
                }
            });
            return updatedStore;
        });
    }
    // Удалить магазин
    deleteStore(storeId) {
        return __awaiter(this, void 0, void 0, function* () {
            const store = yield prisma_1.default.store.findUnique({
                where: { id: storeId },
                include: {
                    products: { select: { id: true } },
                    _count: { select: { products: true } }
                }
            });
            if (!store) {
                throw new errorHandler_1.AppError('Магазин не найден', 404);
            }
            if (store._count.products > 0) {
                throw new errorHandler_1.AppError('Нельзя удалить магазин с товарами', 400);
            }
            yield prisma_1.default.store.delete({
                where: { id: storeId }
            });
        });
    }
    // Получить заказы для магазина
    getStoreOrders(storeId, pagination) {
        return __awaiter(this, void 0, void 0, function* () {
            const { page = 1, limit = 10, sortBy = 'createdAt', sortOrder = 'desc' } = pagination;
            const skip = (page - 1) * limit;
            const whereClause = {
                items: {
                    some: {
                        product: {
                            storeId: storeId
                        }
                    }
                }
            };
            const [orders, total] = yield Promise.all([
                prisma_1.default.order.findMany({
                    where: whereClause,
                    skip,
                    take: limit,
                    orderBy: { [sortBy]: sortOrder },
                    include: {
                        user: {
                            select: {
                                id: true,
                                name: true,
                                telegram_user_id: true,
                                phone_number: true
                            }
                        },
                        items: {
                            where: {
                                product: {
                                    storeId: storeId
                                }
                            },
                            include: {
                                product: {
                                    select: {
                                        id: true,
                                        name: true,
                                        price: true,
                                        image: true
                                    }
                                },
                                storeConfirmation: true
                            }
                        },
                        statuses: {
                            orderBy: { createdAt: 'desc' },
                            select: {
                                id: true,
                                status: true,
                                createdAt: true
                            }
                        }
                    }
                }),
                prisma_1.default.order.count({ where: whereClause })
            ]);
            // Добавляем информацию о статусе и сумме заказа
            const ordersWithDetails = orders.map(order => {
                var _a;
                const storeItems = order.items;
                const storeTotal = storeItems.reduce((sum, item) => sum + (item.quantity * (item.price || 0)), 0);
                return Object.assign(Object.assign({}, order), { currentStatus: ((_a = order.statuses[0]) === null || _a === void 0 ? void 0 : _a.status) || null, storeTotal, storeItemsCount: storeItems.length });
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
        });
    }
    // Получить элементы заказов для подтверждения магазином
    getStoreOrderItems(storeId_1, pagination_1) {
        return __awaiter(this, arguments, void 0, function* (storeId, pagination, filters = {}) {
            const { page = 1, limit = 10, sortBy = 'createdAt', sortOrder = 'desc' } = pagination;
            const { status, orderId } = filters;
            const skip = (page - 1) * limit;
            const whereClause = {
                product: {
                    storeId
                }
            };
            if (orderId) {
                whereClause.orderId = orderId;
            }
            if (status) {
                if (status === 'PENDING') {
                    whereClause.storeConfirmation = null;
                }
                else {
                    whereClause.storeConfirmation = {
                        status
                    };
                }
            }
            const [orderItems, total] = yield Promise.all([
                prisma_1.default.orderItem.findMany({
                    where: whereClause,
                    skip,
                    take: limit,
                    orderBy: { [sortBy]: sortOrder },
                    include: {
                        order: {
                            select: {
                                id: true,
                                address: true,
                                createdAt: true,
                                user: {
                                    select: {
                                        id: true,
                                        name: true,
                                        telegram_user_id: true,
                                        phone_number: true
                                    }
                                },
                                statuses: {
                                    orderBy: { createdAt: 'desc' },
                                    take: 1,
                                    select: {
                                        status: true,
                                        createdAt: true
                                    }
                                }
                            }
                        },
                        product: {
                            select: {
                                id: true,
                                name: true,
                                price: true,
                                image: true
                            }
                        },
                        storeConfirmation: {
                            include: {
                                confirmedBy: {
                                    select: {
                                        id: true,
                                        name: true,
                                        telegram_user_id: true
                                    }
                                }
                            }
                        }
                    }
                }),
                prisma_1.default.orderItem.count({ where: whereClause })
            ]);
            // Добавляем статус подтверждения
            const itemsWithConfirmationStatus = orderItems.map(item => {
                var _a, _b, _c, _d, _e, _f;
                return (Object.assign(Object.assign({}, item), { confirmationStatus: ((_a = item.storeConfirmation) === null || _a === void 0 ? void 0 : _a.status) || 'PENDING', confirmedQuantity: ((_b = item.storeConfirmation) === null || _b === void 0 ? void 0 : _b.confirmedQuantity) || null, confirmationNotes: ((_c = item.storeConfirmation) === null || _c === void 0 ? void 0 : _c.notes) || null, confirmedAt: ((_d = item.storeConfirmation) === null || _d === void 0 ? void 0 : _d.confirmedAt) || null, confirmedBy: ((_e = item.storeConfirmation) === null || _e === void 0 ? void 0 : _e.confirmedBy) || null, currentOrderStatus: ((_f = item.order.statuses[0]) === null || _f === void 0 ? void 0 : _f.status) || null }));
            });
            return {
                data: itemsWithConfirmationStatus,
                meta: {
                    page,
                    limit,
                    total,
                    totalPages: Math.ceil(total / limit)
                }
            };
        });
    }
    // Подтвердить наличие товара в заказе
    confirmOrderItem(orderItemId, storeId, userId, confirmationData) {
        return __awaiter(this, void 0, void 0, function* () {
            var _a;
            const { status, confirmedQuantity, notes } = confirmationData;
            // Проверяем, что элемент заказа принадлежит этому магазину
            const orderItem = yield prisma_1.default.orderItem.findFirst({
                where: {
                    id: orderItemId,
                    product: {
                        storeId
                    }
                },
                include: {
                    product: true,
                    order: {
                        include: {
                            statuses: {
                                orderBy: { createdAt: 'desc' },
                                take: 1
                            }
                        }
                    },
                    storeConfirmation: true
                }
            });
            if (!orderItem) {
                throw new errorHandler_1.AppError('Элемент заказа не найден или не принадлежит вашему магазину', 404);
            }
            // Проверяем, что заказ еще можно подтверждать
            const currentOrderStatus = (_a = orderItem.order.statuses[0]) === null || _a === void 0 ? void 0 : _a.status;
            if (!currentOrderStatus || ['DELIVERED', 'CANCELLED'].includes(currentOrderStatus)) {
                throw new errorHandler_1.AppError('Нельзя подтверждать товары для завершенного или отмененного заказа', 400);
            }
            // Валидация количества
            if (status === 'CONFIRMED' && confirmedQuantity !== orderItem.quantity) {
                throw new errorHandler_1.AppError('При полном подтверждении количество должно совпадать с заказанным', 400);
            }
            if (status === 'PARTIAL') {
                if (!confirmedQuantity || confirmedQuantity <= 0 || confirmedQuantity >= orderItem.quantity) {
                    throw new errorHandler_1.AppError('При частичном подтверждении количество должно быть больше 0 и меньше заказанного', 400);
                }
            }
            if (status === 'REJECTED' && confirmedQuantity && confirmedQuantity > 0) {
                throw new errorHandler_1.AppError('При отклонении подтвержденное количество должно быть 0', 400);
            }
            // Создаем или обновляем подтверждение
            const confirmation = yield prisma_1.default.storeOrderConfirmation.upsert({
                where: {
                    orderItemId
                },
                create: {
                    orderItemId,
                    storeId,
                    status,
                    confirmedQuantity: status === 'REJECTED' ? 0 : (confirmedQuantity || orderItem.quantity),
                    notes,
                    confirmedAt: new Date(),
                    confirmedById: userId
                },
                update: {
                    status,
                    confirmedQuantity: status === 'REJECTED' ? 0 : (confirmedQuantity || orderItem.quantity),
                    notes,
                    confirmedAt: new Date(),
                    confirmedById: userId
                },
                include: {
                    orderItem: {
                        include: {
                            product: true,
                            order: {
                                select: {
                                    id: true,
                                    address: true,
                                    user: {
                                        select: {
                                            id: true,
                                            name: true,
                                            telegram_user_id: true,
                                            phone_number: true
                                        }
                                    }
                                }
                            }
                        }
                    },
                    confirmedBy: {
                        select: {
                            id: true,
                            name: true,
                            telegram_user_id: true
                        }
                    }
                }
            });
            return confirmation;
        });
    }
    // Получить статистику подтверждений для магазина
    getStoreConfirmationStats(storeId) {
        return __awaiter(this, void 0, void 0, function* () {
            const [totalItems, pendingItems, confirmedItems, partialItems, rejectedItems, todayConfirmations] = yield Promise.all([
                prisma_1.default.orderItem.count({
                    where: {
                        product: { storeId }
                    }
                }),
                prisma_1.default.orderItem.count({
                    where: {
                        product: { storeId },
                        storeConfirmation: null
                    }
                }),
                prisma_1.default.storeOrderConfirmation.count({
                    where: {
                        storeId,
                        status: 'CONFIRMED'
                    }
                }),
                prisma_1.default.storeOrderConfirmation.count({
                    where: {
                        storeId,
                        status: 'PARTIAL'
                    }
                }),
                prisma_1.default.storeOrderConfirmation.count({
                    where: {
                        storeId,
                        status: 'REJECTED'
                    }
                }),
                prisma_1.default.storeOrderConfirmation.count({
                    where: {
                        storeId,
                        confirmedAt: {
                            gte: new Date(new Date().setHours(0, 0, 0, 0))
                        }
                    }
                })
            ]);
            return {
                totalItems,
                pendingItems,
                confirmedItems,
                partialItems,
                rejectedItems,
                todayConfirmations,
                confirmationRate: totalItems > 0 ? Math.round(((confirmedItems + partialItems) / totalItems) * 100) : 0
            };
        });
    }
}
exports.StoreService = StoreService;
