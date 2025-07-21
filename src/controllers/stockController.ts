import { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { AuthRequest } from '../middlewares/auth';

const prisma = new PrismaClient();

export const createStockMovement = async (req: AuthRequest, res: Response) => {
  const { productId, quantity, type } = req.body;
  if (!productId || !quantity || !type) return res.status(400).json({ message: 'productId, quantity, type обязательны' });
  if (!['INCOME', 'OUTCOME'].includes(type)) return res.status(400).json({ message: 'type должен быть INCOME или OUTCOME' });
  const movement = await prisma.stockMovement.create({
    data: {
      productId,
      quantity,
      type,
      adminId: req.user!.id
    }
  });
  res.status(201).json(movement);
};

export const getStock = async (req: Request, res: Response) => {
  const { productId } = req.params;
  const movements = await prisma.stockMovement.findMany({ where: { productId: Number(productId) } });
  const stock = movements.reduce((acc: number, m: { type: string; quantity: number }) => acc + (m.type === 'INCOME' ? m.quantity : -m.quantity), 0);
  res.json({ productId, stock });
};

export const getStockHistory = async (req: Request, res: Response) => {
  const { productId } = req.params;
  const history = await prisma.stockMovement.findMany({ where: { productId: Number(productId) }, orderBy: { createdAt: 'desc' } });
  res.json(history);
};
