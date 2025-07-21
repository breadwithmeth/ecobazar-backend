// Получить все заказы (только для ADMIN)
import { NextFunction } from 'express';

export const getAllOrders = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const orders = await prisma.order.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        items: { include: { product: true } },
        user: { include: { addresses: true } },
        statuses: true
      }
    });
    res.json(orders);
  } catch (err) {
    next(err);
  }
};
import { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { AuthRequest } from '../middlewares/auth';

const prisma = new PrismaClient();

export const createOrder = async (req: AuthRequest, res: Response) => {
  const { items, address } = req.body; // [{ productId, quantity }], address: string
  if (!items || !Array.isArray(items) || items.length === 0) return res.status(400).json({ message: 'Нет товаров в заказе' });
  if (!address) return res.status(400).json({ message: 'Адрес обязателен' });
  const userId = req.user!.id;
  const order = await prisma.order.create({
    data: {
      userId,
      address,
      items: {
        create: items.map((item: any) => ({ productId: item.productId, quantity: item.quantity }))
      }
    },
    include: { items: true }
  });
  // Списываем остатки
  for (const item of items) {
    await prisma.stockMovement.create({
      data: {
        productId: item.productId,
        quantity: item.quantity,
        type: 'OUTCOME',
        adminId: userId // пользователь, оформивший заказ
      }
    });
  }
  res.status(201).json(order);
};

export const getOrders = async (req: AuthRequest, res: Response) => {
  const userId = req.user!.id;
  // Получаем только заказы, у которых последний статус не DELIVERED
  const orders = await prisma.order.findMany({
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
  const result = orders.map(order => ({
    ...order,
    status: order.statuses[0]?.status || null,
    statuses: undefined // скрываем массив статусов
  }));
  res.json(result);
};
