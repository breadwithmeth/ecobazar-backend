// Контроллер для изменения цены товара
import { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

export const updateProductPrice = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { price } = req.body;
    if (typeof price !== 'number' || price < 0) {
      return res.status(400).json({ error: 'Некорректная цена' });
    }
    const product = await prisma.product.update({
      where: { id: Number(id) },
      data: { price },
    });
    res.json(product);
  } catch (error) {
    res.status(404).json({ error: 'Товар не найден' });
  }
};
