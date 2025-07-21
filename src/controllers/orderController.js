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
exports.getOrders = exports.createOrder = exports.getAllOrders = void 0;
const getAllOrders = (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const orders = yield prisma.order.findMany({
            orderBy: { createdAt: 'desc' },
            include: {
                items: { include: { product: true } },
                user: { include: { addresses: true } },
                statuses: true
            }
        });
        res.json(orders);
    }
    catch (err) {
        next(err);
    }
});
exports.getAllOrders = getAllOrders;
const client_1 = require("@prisma/client");
const prisma = new client_1.PrismaClient();
const createOrder = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { items, address } = req.body; // [{ productId, quantity }], address: string
    if (!items || !Array.isArray(items) || items.length === 0)
        return res.status(400).json({ message: 'Нет товаров в заказе' });
    if (!address)
        return res.status(400).json({ message: 'Адрес обязателен' });
    const userId = req.user.id;
    const order = yield prisma.order.create({
        data: {
            userId,
            address,
            items: {
                create: items.map((item) => ({ productId: item.productId, quantity: item.quantity }))
            }
        },
        include: { items: true }
    });
    // Списываем остатки
    for (const item of items) {
        yield prisma.stockMovement.create({
            data: {
                productId: item.productId,
                quantity: item.quantity,
                type: 'OUTCOME',
                adminId: userId // пользователь, оформивший заказ
            }
        });
    }
    res.status(201).json(order);
});
exports.createOrder = createOrder;
const getOrders = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const userId = req.user.id;
    // Получаем только заказы, у которых последний статус не DELIVERED
    const orders = yield prisma.order.findMany({
        where: {
            userId,
            statuses: {
                some: {
                    // Находим заказы, где есть хотя бы один статус НЕ DELIVERED
                    NOT: { status: 'DELIVERED' }
                }
            }
        },
        include: {
            items: { include: { product: true } },
            statuses: { orderBy: { createdAt: 'desc' }, take: 1 } // только последний статус
        }
    });
    // Для каждого заказа возвращаем только последний статус
    const result = orders.map(order => {
        var _a;
        return (Object.assign(Object.assign({}, order), { status: ((_a = order.statuses[0]) === null || _a === void 0 ? void 0 : _a.status) || null, statuses: undefined // скрываем массив статусов
         }));
    });
    res.json(result);
});
exports.getOrders = getOrders;
