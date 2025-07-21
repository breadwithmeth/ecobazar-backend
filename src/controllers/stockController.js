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
exports.getStockHistory = exports.getStock = exports.createStockMovement = void 0;
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
