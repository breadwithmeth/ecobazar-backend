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
const client_1 = require("@prisma/client");
const telegramService_1 = require("../services/telegramService");
const prisma = new client_1.PrismaClient();
// Изменить статус заказа (PUT /api/orders/:id/status)
const updateOrderStatus = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { id } = req.params;
    const { status } = req.body;
    if (!req.user || req.user.role !== 'ADMIN')
        return res.status(403).json({ message: 'Требуется роль администратора' });
    const allowed = ['NEW', 'WAITING_PAYMENT', 'PREPARING', 'DELIVERING', 'DELIVERED', 'CANCELLED'];
    if (!allowed.includes(status)) {
        return res.status(400).json({ error: 'Некорректный статус' });
    }
    const order = yield prisma.order.findUnique({ where: { id: Number(id) } });
    if (!order)
        return res.status(404).json({ error: 'Заказ не найден' });
    // Добавляем запись в историю статусов
    yield prisma.orderStatus.create({ data: { orderId: Number(id), status } });
    // Отправляем уведомление клиенту о смене статуса
    try {
        console.log(`📢 Отправляем уведомление о смене статуса заказа #${id} на ${status}`);
        yield telegramService_1.telegramService.sendOrderStatusNotification(Number(id), status);
    }
    catch (error) {
        console.error('Ошибка отправки уведомления о статусе:', error);
    }
    // Если статус изменился на DELIVERED, отправляем запрос на оценку
    if (status === 'DELIVERED') {
        try {
            console.log(`📊 Заказ #${id} доставлен, отправляем запрос на оценку доставки`);
            yield telegramService_1.telegramService.sendRatingRequest(Number(id));
        }
        catch (error) {
            console.error('Ошибка отправки запроса на оценку:', error);
        }
    }
    res.json({ success: true });
});
exports.updateOrderStatus = updateOrderStatus;
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
