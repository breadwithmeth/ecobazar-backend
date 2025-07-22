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
exports.ProductService = void 0;
const prisma_1 = __importDefault(require("../lib/prisma"));
const errorHandler_1 = require("../middlewares/errorHandler");
const apiResponse_1 = require("../utils/apiResponse");
class ProductService {
    createProduct(data) {
        return __awaiter(this, void 0, void 0, function* () {
            var _a;
            // Проверяем существование магазина
            const store = yield prisma_1.default.store.findUnique({
                where: { id: data.storeId }
            });
            if (!store) {
                throw new errorHandler_1.AppError('Магазин не найден', 404);
            }
            // Проверяем существование категории, если указана
            if (data.categoryId) {
                const category = yield prisma_1.default.category.findUnique({
                    where: { id: data.categoryId }
                });
                if (!category) {
                    throw new errorHandler_1.AppError('Категория не найдена', 404);
                }
            }
            return prisma_1.default.product.create({
                data: {
                    name: data.name.trim(),
                    price: data.price,
                    storeId: data.storeId,
                    image: ((_a = data.image) === null || _a === void 0 ? void 0 : _a.trim()) || null,
                    categoryId: data.categoryId || null
                },
                include: {
                    store: {
                        select: { id: true, name: true, address: true }
                    },
                    category: {
                        select: { id: true, name: true }
                    }
                }
            });
        });
    }
    getProducts() {
        return __awaiter(this, arguments, void 0, function* (filters = {}, pagination) {
            const { skip, take } = apiResponse_1.PaginationUtil.getSkipTake(pagination.page, pagination.limit);
            // Строим фильтры
            const whereClause = {};
            if (filters.search) {
                whereClause.name = apiResponse_1.FilterUtil.buildStringFilter(filters.search);
            }
            if (filters.storeId) {
                whereClause.storeId = filters.storeId;
            }
            if (filters.categoryId) {
                whereClause.categoryId = filters.categoryId;
            }
            if (filters.minPrice !== undefined || filters.maxPrice !== undefined) {
                whereClause.price = {};
                if (filters.minPrice !== undefined) {
                    whereClause.price.gte = filters.minPrice;
                }
                if (filters.maxPrice !== undefined) {
                    whereClause.price.lte = filters.maxPrice;
                }
            }
            // Строим сортировку
            const orderBy = apiResponse_1.PaginationUtil.buildOrderBy(pagination.sortBy, pagination.sortOrder);
            const [products, total] = yield Promise.all([
                prisma_1.default.product.findMany({
                    where: whereClause,
                    include: {
                        store: {
                            select: { id: true, name: true, address: true }
                        },
                        category: {
                            select: { id: true, name: true }
                        }
                    },
                    orderBy,
                    skip,
                    take
                }),
                prisma_1.default.product.count({ where: whereClause })
            ]);
            return {
                data: products,
                meta: {
                    page: pagination.page,
                    limit: pagination.limit,
                    total,
                    totalPages: Math.ceil(total / pagination.limit)
                }
            };
        });
    }
    getProductById(id) {
        return __awaiter(this, void 0, void 0, function* () {
            const product = yield prisma_1.default.product.findUnique({
                where: { id },
                include: {
                    store: {
                        select: { id: true, name: true, address: true }
                    },
                    category: {
                        select: { id: true, name: true }
                    }
                }
            });
            if (!product) {
                throw new errorHandler_1.AppError('Товар не найден', 404);
            }
            return product;
        });
    }
    updateProduct(id, data) {
        return __awaiter(this, void 0, void 0, function* () {
            const existingProduct = yield prisma_1.default.product.findUnique({
                where: { id }
            });
            if (!existingProduct) {
                throw new errorHandler_1.AppError('Товар не найден', 404);
            }
            // Проверяем существование магазина, если он изменяется
            if (data.storeId && data.storeId !== existingProduct.storeId) {
                const store = yield prisma_1.default.store.findUnique({
                    where: { id: data.storeId }
                });
                if (!store) {
                    throw new errorHandler_1.AppError('Магазин не найден', 404);
                }
            }
            // Проверяем существование категории, если она изменяется
            if (data.categoryId && data.categoryId !== existingProduct.categoryId) {
                const category = yield prisma_1.default.category.findUnique({
                    where: { id: data.categoryId }
                });
                if (!category) {
                    throw new errorHandler_1.AppError('Категория не найдена', 404);
                }
            }
            const updateData = {};
            if (data.name !== undefined)
                updateData.name = data.name.trim();
            if (data.price !== undefined)
                updateData.price = data.price;
            if (data.storeId !== undefined)
                updateData.storeId = data.storeId;
            if (data.image !== undefined)
                updateData.image = data.image ? data.image.trim() : null;
            if (data.categoryId !== undefined)
                updateData.categoryId = data.categoryId || null;
            return prisma_1.default.product.update({
                where: { id },
                data: updateData,
                include: {
                    store: {
                        select: { id: true, name: true, address: true }
                    },
                    category: {
                        select: { id: true, name: true }
                    }
                }
            });
        });
    }
    deleteProduct(id) {
        return __awaiter(this, void 0, void 0, function* () {
            const existingProduct = yield prisma_1.default.product.findUnique({
                where: { id }
            });
            if (!existingProduct) {
                throw new errorHandler_1.AppError('Товар не найден', 404);
            }
            // Проверяем, нет ли связанных заказов
            const orderItems = yield prisma_1.default.orderItem.findFirst({
                where: { productId: id }
            });
            if (orderItems) {
                throw new errorHandler_1.AppError('Нельзя удалить товар, который есть в заказах', 400);
            }
            yield prisma_1.default.product.delete({
                where: { id }
            });
        });
    }
    getProductStock(productId) {
        return __awaiter(this, void 0, void 0, function* () {
            const movements = yield prisma_1.default.stockMovement.findMany({
                where: { productId },
                select: { quantity: true, type: true }
            });
            const stock = movements.reduce((sum, movement) => {
                return movement.type === 'INCOME'
                    ? sum + movement.quantity
                    : sum - movement.quantity;
            }, 0);
            return { productId, stock };
        });
    }
}
exports.ProductService = ProductService;
