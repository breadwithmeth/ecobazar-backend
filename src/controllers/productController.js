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
Object.defineProperty(exports, "__esModule", { value: true });
exports.getProducts = exports.createProduct = void 0;
const client_1 = require("@prisma/client");
const prisma = new client_1.PrismaClient();
const createProduct = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { name, price, storeId, image, categoryId } = req.body;
    if (!name || !price || !storeId)
        return res.status(400).json({ message: 'Имя, цена и магазин обязательны' });
    const data = { name, price, storeId, image };
    if (categoryId)
        data.categoryId = categoryId;
    const product = yield prisma.product.create({ data });
    res.status(201).json(product);
});
exports.createProduct = createProduct;
const getProducts = (_req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const products = yield prisma.product.findMany({ include: { store: true } });
    const productIds = products.map(p => p.id);
    // Получаем все движения по всем товарам одним запросом
    const movements = yield prisma.stockMovement.findMany({
        where: { productId: { in: productIds } },
        select: { productId: true, type: true, quantity: true }
    });
    // Группируем и считаем остатки
    const stockMap = new Map();
    for (const m of movements) {
        const prev = stockMap.get(m.productId) || 0;
        stockMap.set(m.productId, prev + (m.type === 'INCOME' ? m.quantity : -m.quantity));
    }
    const productsWithStock = products.map(product => (Object.assign(Object.assign({}, product), { stock: stockMap.get(product.id) || 0 })));
    res.json(productsWithStock);
});
exports.getProducts = getProducts;
