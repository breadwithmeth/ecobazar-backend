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
var __rest = (this && this.__rest) || function (s, e) {
    var t = {};
    for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p) && e.indexOf(p) < 0)
        t[p] = s[p];
    if (s != null && typeof Object.getOwnPropertySymbols === "function")
        for (var i = 0, p = Object.getOwnPropertySymbols(s); i < p.length; i++) {
            if (e.indexOf(p[i]) < 0 && Object.prototype.propertyIsEnumerable.call(s, p[i]))
                t[p[i]] = s[p[i]];
        }
    return t;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getStoreStats = exports.confirmOrderItem = exports.getStoreOrderItems = exports.getStoreOrders = exports.deleteStore = exports.assignStoreOwner = exports.updateMyStore = exports.updateStore = exports.createStore = exports.getMyStore = exports.getStore = exports.getStores = void 0;
const apiResponse_1 = require("../utils/apiResponse");
const errorHandler_1 = require("../middlewares/errorHandler");
const storeService_1 = require("../services/storeService");
const zodValidation_1 = require("../middlewares/zodValidation");
const zod_1 = require("zod");
const schemas_1 = require("../validators/schemas");
const storeService = new storeService_1.StoreService();
// Получить все магазины (публичный доступ)
exports.getStores = [
    (0, zodValidation_1.validateQuery)(schemas_1.paginationSchema.merge(schemas_1.storeFilterSchema)),
    (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
        try {
            const _a = req.validatedQuery, { page, limit, sortBy, sortOrder } = _a, filters = __rest(_a, ["page", "limit", "sortBy", "sortOrder"]);
            const pagination = { page, limit, sortBy, sortOrder };
            const result = yield storeService.getStores(pagination, filters);
            apiResponse_1.ApiResponseUtil.paginated(res, result.data, result.meta);
        }
        catch (error) {
            next(error);
        }
    })
];
// Получить магазин по ID (публичный доступ)
exports.getStore = [
    (0, zodValidation_1.validateParams)(schemas_1.idSchema),
    (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
        try {
            const { id } = req.validatedParams;
            const store = yield storeService.getStoreById(id);
            apiResponse_1.ApiResponseUtil.success(res, store);
        }
        catch (error) {
            next(error);
        }
    })
];
// Получить мой магазин (для SELLER)
const getMyStore = (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        if (req.user.role !== 'SELLER') {
            throw new errorHandler_1.AppError('Доступ только для продавцов', 403);
        }
        const store = yield storeService.getStoreByOwner(req.user.id);
        if (!store) {
            throw new errorHandler_1.AppError('У вас нет назначенного магазина', 404);
        }
        apiResponse_1.ApiResponseUtil.success(res, store);
    }
    catch (error) {
        next(error);
    }
});
exports.getMyStore = getMyStore;
// Создать магазин (только для ADMIN)
exports.createStore = [
    (0, zodValidation_1.validateBody)(schemas_1.createStoreSchema),
    (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
        try {
            const storeData = req.validatedBody;
            const store = yield storeService.createStore(storeData);
            apiResponse_1.ApiResponseUtil.success(res, store, 'Магазин успешно создан', 201);
        }
        catch (error) {
            next(error);
        }
    })
];
// Обновить магазин (ADMIN или владелец магазина)
exports.updateStore = [
    (0, zodValidation_1.validateParams)(schemas_1.idSchema),
    (0, zodValidation_1.validateBody)(schemas_1.updateStoreSchema),
    (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
        try {
            const { id } = req.validatedParams;
            const updateData = req.validatedBody;
            const userId = req.user.id;
            const isAdmin = req.user.role === 'ADMIN';
            const store = yield storeService.updateStore(id, updateData, userId, isAdmin);
            apiResponse_1.ApiResponseUtil.success(res, store, 'Магазин успешно обновлен');
        }
        catch (error) {
            next(error);
        }
    })
];
// Обновить свой магазин (только для SELLER)
exports.updateMyStore = [
    (0, zodValidation_1.validateBody)(schemas_1.updateStoreSchema),
    (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
        try {
            const updateData = req.validatedBody;
            const userId = req.user.id;
            // Получаем магазин пользователя
            const userStore = yield storeService.getStoreByOwner(userId);
            if (!userStore) {
                throw new errorHandler_1.AppError('У вас нет назначенного магазина', 404);
            }
            const store = yield storeService.updateStore(userStore.id, updateData, userId, false);
            apiResponse_1.ApiResponseUtil.success(res, store, 'Ваш магазин успешно обновлен');
        }
        catch (error) {
            next(error);
        }
    })
];
// Назначить владельца магазина (только для ADMIN)
exports.assignStoreOwner = [
    (0, zodValidation_1.validateParams)(schemas_1.idSchema),
    (0, zodValidation_1.validateBody)(schemas_1.assignStoreOwnerSchema),
    (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
        try {
            const { id } = req.validatedParams;
            const { ownerId } = req.validatedBody;
            const store = yield storeService.assignOwner(id, ownerId);
            apiResponse_1.ApiResponseUtil.success(res, store, 'Владелец магазина назначен');
        }
        catch (error) {
            next(error);
        }
    })
];
// Удалить магазин (только для ADMIN)
exports.deleteStore = [
    (0, zodValidation_1.validateParams)(schemas_1.idSchema),
    (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
        try {
            const { id } = req.validatedParams;
            yield storeService.deleteStore(id);
            apiResponse_1.ApiResponseUtil.success(res, null, 'Магазин удален');
        }
        catch (error) {
            next(error);
        }
    })
];
// Получить заказы для моего магазина (для SELLER)
exports.getStoreOrders = [
    (0, zodValidation_1.validateQuery)(schemas_1.paginationSchema),
    (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
        try {
            if (req.user.role !== 'SELLER') {
                throw new errorHandler_1.AppError('Доступ только для продавцов', 403);
            }
            const { page, limit, sortBy, sortOrder } = req.validatedQuery;
            const pagination = { page, limit, sortBy, sortOrder };
            const store = yield storeService.getStoreByOwner(req.user.id);
            if (!store) {
                throw new errorHandler_1.AppError('У вас нет назначенного магазина', 404);
            }
            const result = yield storeService.getStoreOrders(store.id, pagination);
            apiResponse_1.ApiResponseUtil.paginated(res, result.data, result.meta);
        }
        catch (error) {
            next(error);
        }
    })
];
// Получить элементы заказов для подтверждения (для SELLER)
exports.getStoreOrderItems = [
    (0, zodValidation_1.validateQuery)(schemas_1.paginationSchema.extend({
        status: zod_1.z.enum(['PENDING', 'CONFIRMED', 'PARTIAL', 'REJECTED']).optional(),
        orderId: zod_1.z.string().transform(Number).optional()
    })),
    (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
        try {
            if (req.user.role !== 'SELLER') {
                throw new errorHandler_1.AppError('Доступ только для продавцов', 403);
            }
            const { page, limit, sortBy, sortOrder, status, orderId } = req.validatedQuery;
            const pagination = { page, limit, sortBy, sortOrder };
            const store = yield storeService.getStoreByOwner(req.user.id);
            if (!store) {
                throw new errorHandler_1.AppError('У вас нет назначенного магазина', 404);
            }
            const result = yield storeService.getStoreOrderItems(store.id, pagination, { status, orderId });
            apiResponse_1.ApiResponseUtil.paginated(res, result.data, result.meta);
        }
        catch (error) {
            next(error);
        }
    })
];
// Подтвердить элемент заказа (для SELLER)
exports.confirmOrderItem = [
    (0, zodValidation_1.validateParams)(zod_1.z.object({
        orderItemId: zod_1.z.string().transform(Number)
    })),
    (0, zodValidation_1.validateBody)(schemas_1.storeConfirmationSchema),
    (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
        try {
            if (req.user.role !== 'SELLER') {
                throw new errorHandler_1.AppError('Доступ только для продавцов', 403);
            }
            const { orderItemId } = req.validatedParams;
            const confirmationData = req.validatedBody;
            const store = yield storeService.getStoreByOwner(req.user.id);
            if (!store) {
                throw new errorHandler_1.AppError('У вас нет назначенного магазина', 404);
            }
            const confirmation = yield storeService.confirmOrderItem(orderItemId, store.id, req.user.id, confirmationData);
            apiResponse_1.ApiResponseUtil.success(res, confirmation, 'Подтверждение товара обновлено');
        }
        catch (error) {
            next(error);
        }
    })
];
// Получить статистику подтверждений (для SELLER)
const getStoreStats = (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        if (req.user.role !== 'SELLER') {
            throw new errorHandler_1.AppError('Доступ только для продавцов', 403);
        }
        const store = yield storeService.getStoreByOwner(req.user.id);
        if (!store) {
            throw new errorHandler_1.AppError('У вас нет назначенного магазина', 404);
        }
        const stats = yield storeService.getStoreConfirmationStats(store.id);
        apiResponse_1.ApiResponseUtil.success(res, stats);
    }
    catch (error) {
        next(error);
    }
});
exports.getStoreStats = getStoreStats;
