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
exports.addOrderStatus = exports.getOrderStatuses = exports.updateOrderStatus = void 0;
// Изменить статус заказа (PUT /api/orders/:id/status)
const updateOrderStatus = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { id } = req.params;
    const { status } = req.body;
    if (!req.user || req.user.role !== 'ADMIN')
        return res.status(403).json({ message: 'Требуется роль администратора' });
    const allowed = ['NEW', 'WAITING_PAYMENT', 'ASSEMBLY', 'SHIPPING', 'DELIVERED'];
    if (!allowed.includes(status)) {
        return res.status(400).json({ error: 'Некорректный статус' });
    }
    const order = yield prisma.order.findUnique({ where: { id: Number(id) } });
    if (!order)
        return res.status(404).json({ error: 'Заказ не найден' });
    // Только добавляем запись в историю статусов
    yield prisma.orderStatus.create({ data: { orderId: Number(id), status } });
    res.json({ success: true });
});
exports.updateOrderStatus = updateOrderStatus;
const client_1 = require("@prisma/client");
const prisma = new client_1.PrismaClient();
// Получить историю статусов заказа
const getOrderStatuses = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { orderId } = req.params;
    const statuses = yield prisma.orderStatus.findMany({
        where: { orderId: Number(orderId) },
        orderBy: { createdAt: 'asc' },
        select: { id: true, status: true, createdAt: true },
    });
    res.json(statuses);
});
exports.getOrderStatuses = getOrderStatuses;
// Добавить новый статус заказа (только ADMIN)
const addOrderStatus = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { orderId } = req.params;
    const { status } = req.body;
    if (!req.user || req.user.role !== 'ADMIN')
        return res.status(403).json({ message: 'Требуется роль администратора' });
    if (!status)
        return res.status(400).json({ message: 'status обязателен' });
    const order = yield prisma.order.findUnique({ where: { id: Number(orderId) } });
    if (!order)
        return res.status(404).json({ message: 'Заказ не найден' });
    const newStatus = yield prisma.orderStatus.create({
        data: {
            orderId: order.id,
            status,
        },
    });
    res.status(201).json(newStatus);
});
exports.addOrderStatus = addOrderStatus;
