import { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export const createProduct = async (req: Request, res: Response) => {
  const { name, price, storeId, image, categoryId } = req.body;
  if (!name || !price || !storeId) return res.status(400).json({ message: 'Имя, цена и магазин обязательны' });
  const data: any = { name, price, storeId, image };
  if (categoryId) data.categoryId = categoryId;
  const product = await prisma.product.create({ data });
  res.status(201).json(product);
};

export const getProducts = async (_req: Request, res: Response) => {
  const products = await prisma.product.findMany({ include: { store: true } });
  const productIds = products.map(p => p.id);
  // Получаем все движения по всем товарам одним запросом
  const movements = await prisma.stockMovement.findMany({
    where: { productId: { in: productIds } },
    select: { productId: true, type: true, quantity: true }
  });
  // Группируем и считаем остатки
  const stockMap = new Map();
  for (const m of movements) {
    const prev = stockMap.get(m.productId) || 0;
    stockMap.set(m.productId, prev + (m.type === 'INCOME' ? m.quantity : -m.quantity));
  }
  const productsWithStock = products.map(product => ({
    ...product,
    stock: stockMap.get(product.id) || 0
  }));
  res.json(productsWithStock);
};
