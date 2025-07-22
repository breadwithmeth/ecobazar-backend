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

export const updateStock = async (req: AuthRequest, res: Response) => {
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
    const product = await prisma.product.findUnique({
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
    const movements = await prisma.stockMovement.findMany({
      where: { productId: Number(productId) }
    });
    
    const currentStock = movements.reduce((acc: number, m: { type: string; quantity: number }) => {
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
    const movement = await prisma.stockMovement.create({
      data: {
        productId: Number(productId),
        quantity: Number(quantity),
        type,
        comment: comment || null,
        adminId: req.user!.id
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

  } catch (error) {
    console.error('Error updating stock:', error);
    res.status(500).json({
      success: false,
      error: {
        code: "INTERNAL_ERROR",
        message: "Внутренняя ошибка сервера"
      }
    });
  }
};
