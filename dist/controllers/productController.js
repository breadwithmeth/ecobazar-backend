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
exports.deleteProduct = exports.updateProduct = exports.getProduct = exports.getAllProducts = exports.getProducts = exports.createProduct = void 0;
const prisma_1 = __importDefault(require("../lib/prisma"));
const errorHandler_1 = require("../middlewares/errorHandler");
const apiResponse_1 = require("../utils/apiResponse");
const createProduct = (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { name, price, storeId, image, categoryId } = req.body;
        // Проверяем существование магазина
        const store = yield prisma_1.default.store.findUnique({
            where: { id: storeId }
        });
        if (!store) {
            throw new errorHandler_1.AppError('Магазин не найден', 404);
        }
        // Проверяем существование категории, если указана
        if (categoryId) {
            const category = yield prisma_1.default.category.findUnique({
                where: { id: categoryId }
            });
            if (!category) {
                throw new errorHandler_1.AppError('Категория не найдена', 404);
            }
        }
        const data = {
            name: name.trim(),
            price: parseFloat(price),
            storeId: parseInt(storeId)
        };
        if (image)
            data.image = image.trim();
        if (categoryId)
            data.categoryId = parseInt(categoryId);
        const product = yield prisma_1.default.product.create({
            data,
            include: {
                store: {
                    select: { id: true, name: true, address: true }
                },
                category: {
                    select: { id: true, name: true }
                }
            }
        });
        apiResponse_1.ApiResponseUtil.created(res, product, 'Товар успешно создан');
    }
    catch (error) {
        next(error);
    }
});
exports.createProduct = createProduct;
const getProducts = (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { page, limit, sortBy, sortOrder } = apiResponse_1.PaginationUtil.parseQuery(req.query);
        const { skip, take } = apiResponse_1.PaginationUtil.getSkipTake(page, limit);
        // Фильтрация
        const filters = {};
        // Фильтр по категории
        const categoryId = apiResponse_1.FilterUtil.buildNumberFilter(req.query.categoryId);
        if (categoryId)
            filters.categoryId = categoryId;
        // Фильтр по магазину
        const storeId = apiResponse_1.FilterUtil.buildNumberFilter(req.query.storeId);
        if (storeId)
            filters.storeId = storeId;
        // Поиск по названию
        const search = apiResponse_1.FilterUtil.buildStringFilter(req.query.search);
        if (search)
            filters.name = search;
        // Фильтр по цене
        const minPrice = apiResponse_1.FilterUtil.buildNumberFilter(req.query.minPrice);
        const maxPrice = apiResponse_1.FilterUtil.buildNumberFilter(req.query.maxPrice);
        if (minPrice || maxPrice) {
            filters.price = {};
            if (minPrice)
                filters.price.gte = minPrice;
            if (maxPrice)
                filters.price.lte = maxPrice;
        }
        const orderBy = { id: 'desc' };
        // Получаем общее количество товаров
        const total = yield prisma_1.default.product.count({ where: filters });
        // Получаем товары с пагинацией
        const products = yield prisma_1.default.product.findMany({
            where: filters,
            skip,
            take,
            orderBy,
            include: {
                store: {
                    select: { id: true, name: true, address: true }
                },
                category: {
                    select: { id: true, name: true }
                }
            }
        });
        // Получаем остатки для всех товаров одним запросом
        const productIds = products.map(p => p.id);
        const movements = yield prisma_1.default.stockMovement.findMany({
            where: { productId: { in: productIds } },
            select: { productId: true, type: true, quantity: true }
        });
        // Группируем и считаем остатки
        const stockMap = new Map();
        for (const movement of movements) {
            const current = stockMap.get(movement.productId) || 0;
            const change = movement.type === 'INCOME' ? movement.quantity : -movement.quantity;
            stockMap.set(movement.productId, current + change);
        }
        // Добавляем информацию об остатках к товарам
        const productsWithStock = products.map(product => (Object.assign(Object.assign({}, product), { stock: stockMap.get(product.id) || 0, inStock: (stockMap.get(product.id) || 0) > 0 })));
        apiResponse_1.ApiResponseUtil.paginated(res, productsWithStock, {
            page: page || 1,
            limit: limit || 10,
            total
        });
    }
    catch (error) {
        next(error);
    }
});
exports.getProducts = getProducts;
// Новый эндпоинт для получения всех товаров сразу без пагинации
const getAllProducts = (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        // Фильтрация (те же фильтры что и в getProducts, но без пагинации)
        const filters = {};
        // Фильтр по категории
        const categoryId = apiResponse_1.FilterUtil.buildNumberFilter(req.query.categoryId);
        if (categoryId)
            filters.categoryId = categoryId;
        // Фильтр по магазину
        const storeId = apiResponse_1.FilterUtil.buildNumberFilter(req.query.storeId);
        if (storeId)
            filters.storeId = storeId;
        // Поиск по названию
        const search = apiResponse_1.FilterUtil.buildStringFilter(req.query.search);
        if (search)
            filters.name = search;
        // Фильтр по цене
        const minPrice = apiResponse_1.FilterUtil.buildNumberFilter(req.query.minPrice);
        const maxPrice = apiResponse_1.FilterUtil.buildNumberFilter(req.query.maxPrice);
        if (minPrice || maxPrice) {
            filters.price = {};
            if (minPrice)
                filters.price.gte = minPrice;
            if (maxPrice)
                filters.price.lte = maxPrice;
        }
        // Сортировка (по умолчанию по ID)
        const sortBy = req.query.sortBy || 'id';
        const sortOrder = req.query.sortOrder === 'desc' ? 'desc' : 'asc';
        const orderBy = apiResponse_1.PaginationUtil.buildOrderBy(sortBy, sortOrder);
        // Получаем ВСЕ товары без пагинации
        const products = yield prisma_1.default.product.findMany({
            where: filters,
            orderBy,
            include: {
                store: {
                    select: { id: true, name: true, address: true }
                },
                category: {
                    select: { id: true, name: true }
                }
            }
        });
        // Получаем остатки для всех товаров одним запросом
        const productIds = products.map(p => p.id);
        const movements = yield prisma_1.default.stockMovement.findMany({
            where: { productId: { in: productIds } },
            select: { productId: true, type: true, quantity: true }
        });
        // Группируем и считаем остатки
        const stockMap = new Map();
        for (const movement of movements) {
            const current = stockMap.get(movement.productId) || 0;
            const change = movement.type === 'INCOME' ? movement.quantity : -movement.quantity;
            stockMap.set(movement.productId, current + change);
        }
        // Добавляем информацию об остатках к товарам
        const productsWithStock = products.map(product => (Object.assign(Object.assign({}, product), { stock: stockMap.get(product.id) || 0, inStock: (stockMap.get(product.id) || 0) > 0 })));
        apiResponse_1.ApiResponseUtil.success(res, {
            products: productsWithStock,
            total: productsWithStock.length
        });
    }
    catch (error) {
        next(error);
    }
});
exports.getAllProducts = getAllProducts;
const getProduct = (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { id } = req.params;
        const productId = parseInt(id);
        if (isNaN(productId)) {
            throw new errorHandler_1.AppError('Неверный ID товара', 400);
        }
        const product = yield prisma_1.default.product.findUnique({
            where: { id: productId },
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
        // Получаем остаток товара
        const movements = yield prisma_1.default.stockMovement.findMany({
            where: { productId },
            select: { type: true, quantity: true }
        });
        const stock = movements.reduce((total, movement) => {
            return total + (movement.type === 'INCOME' ? movement.quantity : -movement.quantity);
        }, 0);
        const productWithStock = Object.assign(Object.assign({}, product), { stock, inStock: stock > 0 });
        apiResponse_1.ApiResponseUtil.success(res, productWithStock);
    }
    catch (error) {
        next(error);
    }
});
exports.getProduct = getProduct;
const updateProduct = (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { id } = req.params;
        const productId = parseInt(id);
        if (isNaN(productId)) {
            throw new errorHandler_1.AppError('Неверный ID товара', 400);
        }
        const { name, price, storeId, image, categoryId } = req.body;
        // Проверяем существование товара
        const existingProduct = yield prisma_1.default.product.findUnique({
            where: { id: productId }
        });
        if (!existingProduct) {
            throw new errorHandler_1.AppError('Товар не найден', 404);
        }
        // Проверяем существование магазина, если он изменяется
        if (storeId && storeId !== existingProduct.storeId) {
            const store = yield prisma_1.default.store.findUnique({
                where: { id: parseInt(storeId) }
            });
            if (!store) {
                throw new errorHandler_1.AppError('Магазин не найден', 404);
            }
        }
        // Проверяем существование категории, если она изменяется
        if (categoryId && categoryId !== existingProduct.categoryId) {
            const category = yield prisma_1.default.category.findUnique({
                where: { id: parseInt(categoryId) }
            });
            if (!category) {
                throw new errorHandler_1.AppError('Категория не найдена', 404);
            }
        }
        const updateData = {};
        if (name !== undefined)
            updateData.name = name.trim();
        if (price !== undefined)
            updateData.price = parseFloat(price);
        if (storeId !== undefined)
            updateData.storeId = parseInt(storeId);
        if (image !== undefined)
            updateData.image = image ? image.trim() : null;
        if (categoryId !== undefined)
            updateData.categoryId = categoryId ? parseInt(categoryId) : null;
        const updatedProduct = yield prisma_1.default.product.update({
            where: { id: productId },
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
        apiResponse_1.ApiResponseUtil.success(res, updatedProduct, 'Товар успешно обновлен');
    }
    catch (error) {
        next(error);
    }
});
exports.updateProduct = updateProduct;
const deleteProduct = (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { id } = req.params;
        const productId = parseInt(id);
        if (isNaN(productId)) {
            throw new errorHandler_1.AppError('Неверный ID товара', 400);
        }
        // Проверяем существование товара
        const product = yield prisma_1.default.product.findUnique({
            where: { id: productId }
        });
        if (!product) {
            throw new errorHandler_1.AppError('Товар не найден', 404);
        }
        // Проверяем, нет ли активных заказов с этим товаром
        const activeOrders = yield prisma_1.default.orderItem.findFirst({
            where: {
                productId,
                order: {
                    statuses: {
                        some: {
                            status: { not: 'DELIVERED' }
                        }
                    }
                }
            }
        });
        if (activeOrders) {
            throw new errorHandler_1.AppError('Нельзя удалить товар, который есть в активных заказах', 400);
        }
        // Удаляем товар (каскадно удалятся связанные записи)
        yield prisma_1.default.product.delete({
            where: { id: productId }
        });
        apiResponse_1.ApiResponseUtil.success(res, null, 'Товар успешно удален');
    }
    catch (error) {
        next(error);
    }
});
exports.deleteProduct = deleteProduct;
