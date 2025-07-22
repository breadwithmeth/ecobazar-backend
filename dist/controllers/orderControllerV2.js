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
exports.getOrderStatuses = exports.updateOrderStatus = exports.getOrder = exports.getAllOrders = exports.getOrders = exports.createOrder = void 0;
const orderService_1 = require("../services/orderService");
const apiResponse_1 = require("../utils/apiResponse");
const cache_1 = require("../utils/cache");
const schemas_1 = require("../validators/schemas");
const zodValidation_1 = require("../middlewares/zodValidation");
const orderService = new orderService_1.OrderService();
exports.createOrder = [
    (0, zodValidation_1.validateBody)(schemas_1.createOrderSchema),
    (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
        try {
            const userId = req.user.id;
            const order = yield orderService.createOrder(userId, req.body);
            // Инвалидируем кэш заказов
            cache_1.cacheService.invalidatePattern(`orders:*`);
            cache_1.cacheService.invalidatePattern(`user:${userId}:orders:*`);
            apiResponse_1.ApiResponseUtil.created(res, order, 'Заказ успешно создан');
        }
        catch (error) {
            next(error);
        }
    })
];
exports.getOrders = [
    (0, zodValidation_1.validateQuery)(schemas_1.paginationSchema.merge(schemas_1.orderFilterSchema)),
    (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
        try {
            const _a = req.validatedQuery, { page, limit, sortBy, sortOrder } = _a, filters = __rest(_a, ["page", "limit", "sortBy", "sortOrder"]);
            const pagination = { page, limit, sortBy, sortOrder };
            const userId = req.user.id;
            const isAdmin = req.user.role === 'ADMIN';
            // Генерируем ключ кэша
            const cachePrefix = isAdmin ? 'orders' : `user:${userId}:orders`;
            const cacheKey = cache_1.CacheService.generatePaginationKey(cachePrefix, page, limit, Object.assign(Object.assign({}, filters), { sortBy, sortOrder }));
            // Проверяем кэш (короткое время для заказов)
            const result = yield cache_1.cacheService.memoize(cacheKey, () => orderService.getOrders(pagination, userId, filters, isAdmin), 2 * 60 * 1000 // 2 минуты
            );
            apiResponse_1.ApiResponseUtil.paginated(res, result.data, result.meta);
        }
        catch (error) {
            next(error);
        }
    })
];
exports.getAllOrders = [
    (0, zodValidation_1.validateQuery)(schemas_1.paginationSchema.merge(schemas_1.orderFilterSchema)),
    (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
        try {
            const _a = req.validatedQuery, { page, limit, sortBy, sortOrder } = _a, filters = __rest(_a, ["page", "limit", "sortBy", "sortOrder"]);
            const pagination = { page, limit, sortBy, sortOrder };
            // Генерируем ключ кэша для админа
            const cacheKey = cache_1.CacheService.generatePaginationKey('admin:orders', page, limit, Object.assign(Object.assign({}, filters), { sortBy, sortOrder }));
            const result = yield cache_1.cacheService.memoize(cacheKey, () => orderService.getOrders(pagination, undefined, filters, true), 2 * 60 * 1000 // 2 минуты
            );
            apiResponse_1.ApiResponseUtil.paginated(res, result.data, result.meta);
        }
        catch (error) {
            next(error);
        }
    })
];
exports.getOrder = [
    (0, zodValidation_1.validateParams)(schemas_1.idSchema),
    (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
        try {
            const { id } = req.validatedParams;
            const userId = req.user.id;
            const isAdmin = req.user.role === 'ADMIN';
            const cacheKey = isAdmin
                ? cache_1.CacheService.generateResourceKey('admin:order', id)
                : cache_1.CacheService.generateResourceKey(`user:${userId}:order`, id);
            const order = yield cache_1.cacheService.memoize(cacheKey, () => orderService.getOrderById(id, userId, isAdmin), 5 * 60 * 1000 // 5 минут
            );
            apiResponse_1.ApiResponseUtil.success(res, order);
        }
        catch (error) {
            next(error);
        }
    })
];
exports.updateOrderStatus = [
    (0, zodValidation_1.validateParams)(schemas_1.idSchema),
    (0, zodValidation_1.validateBody)(schemas_1.updateOrderStatusSchema),
    (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
        try {
            const { id } = req.validatedParams;
            const { status } = req.body;
            const orderStatus = yield orderService.updateOrderStatus(id, status);
            // Инвалидируем кэш заказов
            cache_1.cacheService.invalidatePattern(`*order*:${id}*`);
            cache_1.cacheService.invalidatePattern('orders:*');
            cache_1.cacheService.invalidatePattern('admin:orders:*');
            apiResponse_1.ApiResponseUtil.success(res, orderStatus, 'Статус заказа обновлен');
        }
        catch (error) {
            next(error);
        }
    })
];
exports.getOrderStatuses = [
    (0, zodValidation_1.validateParams)(schemas_1.idSchema),
    (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
        try {
            const { id } = req.validatedParams;
            const cacheKey = `order:${id}:statuses`;
            const statuses = yield cache_1.cacheService.memoize(cacheKey, () => orderService.getOrderStatuses(id), 5 * 60 * 1000 // 5 минут
            );
            apiResponse_1.ApiResponseUtil.success(res, statuses);
        }
        catch (error) {
            next(error);
        }
    })
];
