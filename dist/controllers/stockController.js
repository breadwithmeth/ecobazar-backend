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
exports.updateStock = exports.getStockHistory = exports.getStock = exports.createStockMovement = void 0;
const client_1 = require("@prisma/client");
const prisma = new client_1.PrismaClient();
const createStockMovement = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { productId, quantity, type } = req.body;
    if (!productId || !quantity || !type)
        return res.status(400).json({ message: 'productId, quantity, type обязательны' });
    if (!['INCOME', 'OUTCOME'].includes(type))
        return res.status(400).json({ message: 'type должен быть INCOME или OUTCOME' });
    const movement = yield prisma.stockMovement.create({
        data: {
            productId,
            quantity,
            type,
            adminId: req.user.id
        }
    });
    res.status(201).json(movement);
});
exports.createStockMovement = createStockMovement;
const getStock = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { productId } = req.params;
    const movements = yield prisma.stockMovement.findMany({ where: { productId: Number(productId) } });
    const stock = movements.reduce((acc, m) => acc + (m.type === 'INCOME' ? m.quantity : -m.quantity), 0);
    res.json({ productId, stock });
});
exports.getStock = getStock;
const getStockHistory = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { productId } = req.params;
    const history = yield prisma.stockMovement.findMany({ where: { productId: Number(productId) }, orderBy: { createdAt: 'desc' } });
    res.json(history);
});
exports.getStockHistory = getStockHistory;
const updateStock = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { productId } = req.params;
        const { quantity, type, comment } = req.body;
        // Валидация данных
        if (!quantity || !type) {
            return res.status(400).json({
                success: false,
                error: {
                    code: "VALIDATION_ERROR",
                    message: "Поля quantity и type обязательны"
                }
            });
        }
        if (!['INCOME', 'OUTCOME', 'CORRECTION'].includes(type)) {
            return res.status(400).json({
                success: false,
                error: {
                    code: "INVALID_TYPE",
                    message: "type должен быть INCOME, OUTCOME или CORRECTION"
                }
            });
        }
        // Проверяем существование продукта
        const product = yield prisma.product.findUnique({
            where: { id: Number(productId) }
        });
        if (!product) {
            return res.status(404).json({
                success: false,
                error: {
                    code: "PRODUCT_NOT_FOUND",
                    message: "Продукт не найден"
                }
            });
        }
        // Получаем текущий остаток
        const movements = yield prisma.stockMovement.findMany({
            where: { productId: Number(productId) }
        });
        const currentStock = movements.reduce((acc, m) => {
            return acc + (m.type === 'INCOME' ? m.quantity : m.type === 'OUTCOME' ? -m.quantity : m.quantity);
        }, 0);
        // Проверяем, достаточно ли товара для расхода
        if (type === 'OUTCOME' && currentStock < quantity) {
            return res.status(400).json({
                success: false,
                error: {
                    code: "INSUFFICIENT_STOCK",
                    message: "Недостаточно товара для расхода"
                }
            });
        }
        // Создаем движение на складе
        const movement = yield prisma.stockMovement.create({
            data: {
                productId: Number(productId),
                quantity: Number(quantity),
                type,
                comment: comment || null,
                adminId: req.user.id
            }
        });
        // Пересчитываем новый остаток
        const newStock = type === 'INCOME' ? currentStock + quantity :
            type === 'OUTCOME' ? currentStock - quantity :
                quantity; // для CORRECTION устанавливаем точное значение
        res.status(200).json({
            success: true,
            data: {
                productId: Number(productId),
                quantity: Number(quantity),
                type,
                comment: comment || null,
                updatedAt: movement.createdAt,
                currentStock: newStock
            },
            message: "Остатки товара обновлены"
        });
    }
    catch (error) {
        console.error('Error updating stock:', error);
        res.status(500).json({
            success: false,
            error: {
                code: "INTERNAL_ERROR",
                message: "Внутренняя ошибка сервера"
            }
        });
    }
});
exports.updateStock = updateStock;
