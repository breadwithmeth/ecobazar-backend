import { Request, Response, NextFunction } from 'express';
import prisma from '../lib/prisma';
import { AppError } from '../middlewares/errorHandler';
import { ApiResponseUtil } from '../utils/apiResponse';
import { AuthRequest } from '../middlewares/auth';
import { logger } from '../utils/logger';

// Создать оценку доставки
export const createDeliveryRating = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { orderId, quality, speed, impression, comment } = req.body;
    const userId = req.user!.id;

    // Проверяем существование заказа и права доступа
    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: {
        statuses: {
          orderBy: { createdAt: 'desc' },
          take: 1,
          select: { status: true }
        },
        deliveryRating: true
      }
    });

    if (!order) {
      throw new AppError('Заказ не найден', 404);
    }

    if (order.userId !== userId) {
      throw new AppError('Вы можете оценить только свои заказы', 403);
    }

    // Проверяем, что заказ доставлен
    const currentStatus = order.statuses[0]?.status;
    if (currentStatus !== 'DELIVERED') {
      throw new AppError('Можно оценить только доставленные заказы', 400);
    }

    // Проверяем, что оценка еще не поставлена
    if (order.deliveryRating) {
      throw new AppError('Оценка для этого заказа уже поставлена', 400);
    }

    // Валидация оценок
    if (quality < 1 || quality > 5 || speed < 1 || speed > 5 || impression < 1 || impression > 5) {
      throw new AppError('Оценки должны быть в диапазоне от 1 до 5', 400);
    }

    // Создаем оценку
    const rating = await prisma.deliveryRating.create({
      data: {
        orderId,
        userId,
        courierId: order.courierId,
        quality,
        speed,
        impression,
        comment: comment?.trim()
      },
      include: {
        order: {
          select: { id: true, address: true }
        },
        courier: {
          select: { id: true, name: true }
        }
      }
    });

    logger.info(`Пользователь ${userId} поставил оценку доставки для заказа ${orderId}: качество ${quality}, скорость ${speed}, впечатление ${impression}`);

    ApiResponseUtil.success(res, rating, 'Спасибо за оценку! Ваше мнение поможет нам улучшить качество доставки');
  } catch (error) {
    next(error);
  }
};

// Получить оценку доставки по заказу
export const getDeliveryRating = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { orderId } = req.params;
    const userId = req.user!.id;
    const isAdmin = req.user!.role === 'ADMIN';

    const rating = await prisma.deliveryRating.findUnique({
      where: { orderId: parseInt(orderId) },
      include: {
        order: {
          select: { id: true, address: true, userId: true }
        },
        user: {
          select: { id: true, name: true }
        },
        courier: {
          select: { id: true, name: true }
        }
      }
    });

    if (!rating) {
      throw new AppError('Оценка не найдена', 404);
    }

    // Проверяем права доступа
    if (!isAdmin && rating.order.userId !== userId) {
      throw new AppError('Недостаточно прав доступа', 403);
    }

    ApiResponseUtil.success(res, rating);
  } catch (error) {
    next(error);
  }
};

// Получить статистику оценок курьера (для админов)
export const getCourierRatingStats = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { courierId } = req.params;

    // Проверяем существование курьера
    const courier = await prisma.user.findUnique({
      where: { id: parseInt(courierId) },
      select: { id: true, name: true, role: true }
    });

    if (!courier) {
      throw new AppError('Курьер не найден', 404);
    }

    if (courier.role !== 'COURIER') {
      throw new AppError('Указанный пользователь не является курьером', 400);
    }

    // Получаем статистику оценок
    const ratings = await prisma.deliveryRating.findMany({
      where: { courierId: parseInt(courierId) },
      select: {
        quality: true,
        speed: true,
        impression: true,
        createdAt: true
      }
    });

    if (ratings.length === 0) {
      return ApiResponseUtil.success(res, {
        courier,
        totalRatings: 0,
        averageQuality: 0,
        averageSpeed: 0,
        averageImpression: 0,
        overallAverage: 0,
        distribution: {
          quality: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 },
          speed: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 },
          impression: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 }
        }
      });
    }

    // Вычисляем средние значения
    const averageQuality = ratings.reduce((sum, r) => sum + r.quality, 0) / ratings.length;
    const averageSpeed = ratings.reduce((sum, r) => sum + r.speed, 0) / ratings.length;
    const averageImpression = ratings.reduce((sum, r) => sum + r.impression, 0) / ratings.length;
    const overallAverage = (averageQuality + averageSpeed + averageImpression) / 3;

    // Вычисляем распределение оценок
    const distribution = {
      quality: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 },
      speed: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 },
      impression: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 }
    };

    ratings.forEach(rating => {
      distribution.quality[rating.quality as keyof typeof distribution.quality]++;
      distribution.speed[rating.speed as keyof typeof distribution.speed]++;
      distribution.impression[rating.impression as keyof typeof distribution.impression]++;
    });

    const stats = {
      courier,
      totalRatings: ratings.length,
      averageQuality: Math.round(averageQuality * 10) / 10,
      averageSpeed: Math.round(averageSpeed * 10) / 10,
      averageImpression: Math.round(averageImpression * 10) / 10,
      overallAverage: Math.round(overallAverage * 10) / 10,
      distribution
    };

    ApiResponseUtil.success(res, stats);
  } catch (error) {
    next(error);
  }
};

// Получить все оценки для заказов (для админов)
export const getAllRatings = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { page = 1, limit = 10, courierId, minRating, maxRating } = req.query;
    
    const skip = (Number(page) - 1) * Number(limit);
    const whereClause: any = {};

    if (courierId) {
      whereClause.courierId = parseInt(courierId as string);
    }

    if (minRating || maxRating) {
      whereClause.AND = [];
      
      if (minRating) {
        const min = parseInt(minRating as string);
        whereClause.AND.push({
          OR: [
            { quality: { gte: min } },
            { speed: { gte: min } },
            { impression: { gte: min } }
          ]
        });
      }
      
      if (maxRating) {
        const max = parseInt(maxRating as string);
        whereClause.AND.push({
          AND: [
            { quality: { lte: max } },
            { speed: { lte: max } },
            { impression: { lte: max } }
          ]
        });
      }
    }

    const total = await prisma.deliveryRating.count({ where: whereClause });

    const ratings = await prisma.deliveryRating.findMany({
      where: whereClause,
      skip,
      take: Number(limit),
      orderBy: { createdAt: 'desc' },
      include: {
        order: {
          select: { id: true, address: true, deliveryType: true, scheduledDate: true }
        },
        user: {
          select: { id: true, name: true, telegram_user_id: true }
        },
        courier: {
          select: { id: true, name: true }
        }
      }
    });

    ApiResponseUtil.paginated(res, ratings, {
      page: Number(page),
      limit: Number(limit),
      total
    });
  } catch (error) {
    next(error);
  }
};
