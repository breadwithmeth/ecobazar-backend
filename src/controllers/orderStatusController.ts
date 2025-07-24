import { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { AuthRequest } from '../middlewares/auth';
import { telegramService } from '../services/telegramService';

const prisma = new PrismaClient();

// Изменить статус заказа (PUT /api/orders/:id/status)
export const updateOrderStatus = async (req: AuthRequest, res: Response) => {
  const { id } = req.params;
  const { status } = req.body;
  if (!req.user || req.user.role !== 'ADMIN') return res.status(403).json({ message: 'Требуется роль администратора' });
  const allowed = ['NEW', 'WAITING_PAYMENT', 'PREPARING', 'DELIVERING', 'DELIVERED', 'CANCELLED'];
  if (!allowed.includes(status)) {
    return res.status(400).json({ error: 'Некорректный статус' });
  }
  const order = await prisma.order.findUnique({ where: { id: Number(id) } });
  if (!order) return res.status(404).json({ error: 'Заказ не найден' });
  
  // Добавляем запись в историю статусов
  await prisma.orderStatus.create({ data: { orderId: Number(id), status } });
  
  // Отправляем уведомление клиенту о смене статуса
  try {
    console.log(`📢 Отправляем уведомление о смене статуса заказа #${id} на ${status}`);
    await telegramService.sendOrderStatusNotification(Number(id), status);
  } catch (error) {
    console.error('Ошибка отправки уведомления о статусе:', error);
  }
  
  // Если статус изменился на DELIVERED, отправляем запрос на оценку
  if (status === 'DELIVERED') {
    try {
      console.log(`📊 Заказ #${id} доставлен, отправляем запрос на оценку доставки`);
      await telegramService.sendRatingRequest(Number(id));
    } catch (error) {
      console.error('Ошибка отправки запроса на оценку:', error);
    }
  }
  
  res.json({ success: true });
};

// Получить историю статусов заказа
export const getOrderStatuses = async (req: Request, res: Response) => {
  const { orderId } = req.params;
  const statuses = await prisma.orderStatus.findMany({
    where: { orderId: Number(orderId) },
    orderBy: { createdAt: 'asc' },
    select: { id: true, status: true, createdAt: true },
  });
  res.json(statuses);
};

// Добавить новый статус заказа (только ADMIN)
export const addOrderStatus = async (req: AuthRequest, res: Response) => {
  const { orderId } = req.params;
  const { status } = req.body;
  if (!req.user || req.user.role !== 'ADMIN') return res.status(403).json({ message: 'Требуется роль администратора' });
  if (!status) return res.status(400).json({ message: 'status обязателен' });
  const order = await prisma.order.findUnique({ where: { id: Number(orderId) } });
  if (!order) return res.status(404).json({ message: 'Заказ не найден' });
  const newStatus = await prisma.orderStatus.create({
    data: {
      orderId: order.id,
      status,
    },
  });
  res.status(201).json(newStatus);
};
