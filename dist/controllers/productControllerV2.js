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
exports.getProductStock = exports.deleteProduct = exports.updateProduct = exports.getProduct = exports.getProducts = exports.createProduct = void 0;
const productService_1 = require("../services/productService");
const apiResponse_1 = require("../utils/apiResponse");
const cache_1 = require("../utils/cache");
const schemas_1 = require("../validators/schemas");
const zodValidation_1 = require("../middlewares/zodValidation");
const productService = new productService_1.ProductService();
exports.createProduct = [
    (0, zodValidation_1.validateBody)(schemas_1.createProductSchema),
    (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
        try {
            const product = yield productService.createProduct(req.body);
            // Инвалидируем кэш продуктов
            cache_1.cacheService.invalidatePattern('products:*');
            apiResponse_1.ApiResponseUtil.created(res, product, 'Товар успешно создан');
        }
        catch (error) {
            next(error);
        }
    })
];
exports.getProducts = [
    (0, zodValidation_1.validateQuery)(schemas_1.paginationSchema.merge(schemas_1.productFilterSchema)),
    (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
        try {
            const _a = req.validatedQuery, { page, limit, sortBy, sortOrder } = _a, filters = __rest(_a, ["page", "limit", "sortBy", "sortOrder"]);
            const pagination = { page, limit, sortBy, sortOrder };
            // Генерируем ключ кэша
            const cacheKey = cache_1.CacheService.generatePaginationKey('products', page, limit, Object.assign(Object.assign({}, filters), { sortBy, sortOrder }));
            // Проверяем кэш
            const result = yield cache_1.cacheService.memoize(cacheKey, () => productService.getProducts(filters, pagination), 5 * 60 * 1000 // 5 минут
            );
            apiResponse_1.ApiResponseUtil.paginated(res, result.data, result.meta);
        }
        catch (error) {
            next(error);
        }
    })
];
exports.getProduct = [
    (0, zodValidation_1.validateParams)(schemas_1.idSchema),
    (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
        try {
            const { id } = req.validatedParams;
            const cacheKey = cache_1.CacheService.generateResourceKey('product', id);
            const product = yield cache_1.cacheService.memoize(cacheKey, () => productService.getProductById(id), 10 * 60 * 1000 // 10 минут
            );
            apiResponse_1.ApiResponseUtil.success(res, product);
        }
        catch (error) {
            next(error);
        }
    })
];
exports.updateProduct = [
    (0, zodValidation_1.validateParams)(schemas_1.idSchema),
    (0, zodValidation_1.validateBody)(schemas_1.updateProductSchema),
    (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
        try {
            const { id } = req.validatedParams;
            const product = yield productService.updateProduct(id, req.body);
            // Инвалидируем кэш
            cache_1.cacheService.delete(cache_1.CacheService.generateResourceKey('product', id));
            cache_1.cacheService.invalidatePattern('products:*');
            apiResponse_1.ApiResponseUtil.success(res, product, 'Товар успешно обновлен');
        }
        catch (error) {
            next(error);
        }
    })
];
exports.deleteProduct = [
    (0, zodValidation_1.validateParams)(schemas_1.idSchema),
    (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
        try {
            const { id } = req.validatedParams;
            yield productService.deleteProduct(id);
            // Инвалидируем кэш
            cache_1.cacheService.delete(cache_1.CacheService.generateResourceKey('product', id));
            cache_1.cacheService.invalidatePattern('products:*');
            apiResponse_1.ApiResponseUtil.success(res, { deleted: true }, 'Товар успешно удален');
        }
        catch (error) {
            next(error);
        }
    })
];
exports.getProductStock = [
    (0, zodValidation_1.validateParams)(schemas_1.idSchema),
    (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
        try {
            const { id } = req.validatedParams;
            const cacheKey = `stock:${id}`;
            const stock = yield cache_1.cacheService.memoize(cacheKey, () => productService.getProductStock(id), 2 * 60 * 1000 // 2 минуты для склада
            );
            apiResponse_1.ApiResponseUtil.success(res, stock);
        }
        catch (error) {
            next(error);
        }
    })
];
