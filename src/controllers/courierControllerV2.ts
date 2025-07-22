import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { AuthRequest } from '../middlewares/auth';
import { AppError } from '../middlewares/errorHandler';
import { ApiResponseUtil } from '../utils/apiResponse';
import { cacheService, CacheService } from '../utils/cache';
import { OrderService } from '../services/orderService';
import { 
  paginationSchema,
  idSchema,
  assignCourierSchema,
  courierOrderStatusSchema
} from '../validators/schemas';
import { validateBody, validateParams, validateQuery } from '../middlewares/zodValidation';
import { logger } from '../utils/logger';
import prisma from '../lib/prisma';

const orderService = new OrderService();

// Получить заказы курьера
export const getCourierOrders = [
  validateQuery(paginationSchema.extend({
    status: z.string().optional()
  })),
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const { page, limit, sortBy, sortOrder, status } = (req as any).validatedQuery;
      const pagination = { page, limit, sortBy, sortOrder };
      const courierId = req.user!.id;
      
      // Генерируем ключ кэша для заказов курьера
      const cacheKey = CacheService.generatePaginationKey(
        `courier:${courierId}:orders`,
        page,
        limit,
        { status, sortBy, sortOrder }
      );
      
      const result = await cacheService.memoize(
        cacheKey,
        async () => {
          const whereClause: any = { courierId };
          
          if (status) {
            whereClause.statuses = {
              some: { status }
            };
          }
          
          const skip = (page - 1) * limit;
          const total = await prisma.order.count({ where: whereClause });
          
          const orders = await prisma.order.findMany({
            where: whereClause,
            skip,
            take: limit,
            orderBy: { [sortBy]: sortOrder },
            include: {
              items: { 
                include: { 
                  product: {
                    select: { id: true, name: true, price: true, image: true }
                  }
                }
              },
              user: { 
                select: { 
                  id: true, 
                  telegram_user_id: true, 
                  name: true, 
                  phone_number: true 
                }
              },
              statuses: { 
                orderBy: { createdAt: 'desc' },
                select: { id: true, status: true, createdAt: true },
                take: 1
              }
            }
          });
          
          // Добавляем общую сумму и текущий статус к каждому заказу
          const ordersWithDetails = orders.map((order: any) => ({
            ...order,
            totalAmount: order.items.reduce((sum: number, item: any) => sum + (item.price || 0) * item.quantity, 0),
            currentStatus: order.statuses[0]?.status || 'NEW',
            statusUpdatedAt: order.statuses[0]?.createdAt
          }));
          
          return {
            data: ordersWithDetails,
            meta: {
              page,
              limit,
              total,
              totalPages: Math.ceil(total / limit)
            }
          };
        },
        2 * 60 * 1000 // 2 минуты кэш
      );
      
      ApiResponseUtil.paginated(res, result.data, result.meta);
    } catch (error) {
      next(error);
    }
  }
];

// Обновить статус заказа курьером (только на DELIVERED)
export const updateOrderStatusByCourier = [
  validateParams(idSchema),
  validateBody(courierOrderStatusSchema),
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const { id: orderId } = (req as any).validatedParams;
      const { status } = req.body;
      const courierId = req.user!.id;
      
      // Проверяем, что заказ назначен этому курьеру
      const order = await prisma.order.findUnique({
        where: { id: orderId },
        select: { 
          id: true, 
          courierId: true,
          statuses: {
            orderBy: { createdAt: 'desc' },
            take: 1,
            select: { status: true }
          }
        }
      });
      
      if (!order) {
        throw new AppError('Заказ не найден', 404);
      }
      
      if (order.courierId !== courierId) {
        logger.warn(`Курьер ${courierId} пытался изменить статус заказа ${orderId}, который ему не назначен`);
        throw new AppError('Заказ не назначен вам', 403);
      }
      
      const currentStatus = order.statuses[0]?.status;
      
      // Курьер может менять статус только на "DELIVERED" и только если заказ в статусе "DELIVERING"
      if (currentStatus !== 'DELIVERING') {
        throw new AppError('Можно отметить доставленным только заказ в статусе "DELIVERING"', 400);
      }
      
      // Создаем новый статус
      await prisma.orderStatus.create({
        data: {
          orderId,
          status: 'DELIVERED'
        }
      });
      
      // Инвалидируем кэш
      cacheService.invalidatePattern(`courier:${courierId}:*`);
      cacheService.invalidatePattern(`*order*:${orderId}*`);
      cacheService.invalidatePattern('admin:orders:*');
      
      // Получаем обновленный заказ
      const updatedOrder = await orderService.getOrderById(orderId, undefined, false);
      
      logger.info(`Курьер ${courierId} отметил заказ ${orderId} как доставленный`);
      
      ApiResponseUtil.success(res, updatedOrder, 'Заказ отмечен как доставленный');
    } catch (error) {
      next(error);
    }
  }
];

// Назначить курьера на заказ (только для админов)
export const assignCourierToOrder = [
  validateBody(assignCourierSchema),
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const { orderId, courierId } = req.body;
      
      // Проверяем существование заказа
      const order = await prisma.order.findUnique({
        where: { id: orderId },
        select: { id: true, courierId: true }
      });
      
      if (!order) {
        throw new AppError('Заказ не найден', 404);
      }
      
      // Проверяем, что пользователь является курьером
      const courier = await prisma.user.findUnique({
        where: { id: courierId },
        select: { id: true, role: true, name: true, phone_number: true }
      });
      
      if (!courier) {
        throw new AppError('Курьер не найден', 404);
      }
      
      if (courier.role !== 'COURIER') {
        throw new AppError('Указанный пользователь не является курьером', 400);
      }
      
      // Проверяем, что заказ не назначен другому курьеру
      if (order.courierId && order.courierId !== courierId) {
        throw new AppError('Заказ уже назначен другому курьеру', 400);
      }
      
      // Транзакция для назначения курьера и обновления статуса
      const result = await prisma.$transaction(async (tx) => {
        // Назначаем курьера
        const updatedOrder = await tx.order.update({
          where: { id: orderId },
          data: { courierId }
        });
        
        // Создаем новый статус "DELIVERING"
        await tx.orderStatus.create({
          data: {
            orderId,
            status: 'DELIVERING'
          }
        });
        
        // Получаем полный заказ с обновленными данными
        return await tx.order.findUnique({
          where: { id: orderId },
          include: {
            courier: {
              select: { id: true, name: true, phone_number: true, telegram_user_id: true }
            },
            items: { 
              include: { 
                product: {
                  select: { id: true, name: true, price: true, image: true }
                }
              }
            },
            user: { 
              select: { 
                id: true, 
                telegram_user_id: true, 
                name: true, 
                phone_number: true 
              }
            },
            statuses: { 
              orderBy: { createdAt: 'desc' },
              select: { id: true, status: true, createdAt: true },
              take: 1
            }
          }
        });
      });
      
      // Инвалидируем кэш
      cacheService.invalidatePattern(`courier:${courierId}:*`);
      cacheService.invalidatePattern(`*order*:${orderId}*`);
      cacheService.invalidatePattern('admin:orders:*');
      
      logger.info(`Админ ${req.user!.id} назначил курьера ${courierId} на заказ ${orderId}`);
      
      ApiResponseUtil.success(res, {
        ...result,
        totalAmount: result!.items.reduce((sum: number, item: any) => sum + (item.price || 0) * item.quantity, 0),
        currentStatus: result!.statuses[0]?.status || 'DELIVERING'
      }, 'Курьер успешно назначен на заказ');
    } catch (error) {
      next(error);
    }
  }
];

// Получить список всех курьеров (для админов)
export const getCouriers = [
  validateQuery(paginationSchema.extend({
    search: z.string().optional()
  })),
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const { page, limit, sortBy, sortOrder, search } = (req as any).validatedQuery;
      
      const cacheKey = CacheService.generatePaginationKey(
        'admin:couriers',
        page,
        limit,
        { search, sortBy, sortOrder }
      );
      
      const result = await cacheService.memoize(
        cacheKey,
        async () => {
          const whereClause: any = { role: 'COURIER' };
          
          if (search) {
            whereClause.OR = [
              { name: { contains: search, mode: 'insensitive' } },
              { phone_number: { contains: search } }
            ];
          }
          
          const skip = (page - 1) * limit;
          const total = await prisma.user.count({ where: whereClause });
          
          const couriers = await prisma.user.findMany({
            where: whereClause,
            skip,
            take: limit,
            orderBy: { [sortBy]: sortOrder },
            select: {
              id: true,
              name: true,
              phone_number: true,
              telegram_user_id: true
            }
          });
          
          // Добавляем статистику для каждого курьера
          const couriersWithStats = await Promise.all(
            couriers.map(async (courier: any) => {
              const activeOrders = await prisma.order.count({
                where: { 
                  courierId: courier.id,
                  statuses: {
                    some: { 
                      status: { 
                        in: ['CONFIRMED', 'PREPARING', 'READY', 'DELIVERING'] 
                      }
                    }
                  }
                }
              });

              const deliveredOrders = await prisma.order.count({
                where: { 
                  courierId: courier.id,
                  statuses: {
                    some: { 
                      status: 'DELIVERED'
                    }
                  }
                }
              });
              
              return {
                ...courier,
                activeOrders,
                totalDelivered: deliveredOrders
              };
            })
          );
          
          return {
            data: couriersWithStats,
            meta: {
              page,
              limit,
              total,
              totalPages: Math.ceil(total / limit)
            }
          };
        },
        5 * 60 * 1000 // 5 минут кэш
      );
      
      ApiResponseUtil.paginated(res, result.data, result.meta);
    } catch (error) {
      next(error);
    }
  }
];

// Получить статистику курьера
export const getCourierStats = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const courierId = req.user!.id;
    
    const cacheKey = `courier:${courierId}:stats`;
    
    const stats = await cacheService.memoize(
      cacheKey,
      async () => {
        // Подсчитываем заказы по статусам
        const totalOrders = await prisma.order.count({
          where: { courierId }
        });
        
        const deliveredOrders = await prisma.order.count({
          where: { 
            courierId,
            statuses: {
              some: { status: 'DELIVERED' }
            }
          }
        });
        
        const activeOrders = await prisma.order.count({
          where: { 
            courierId,
            statuses: {
              some: { 
                status: { 
                  in: ['CONFIRMED', 'PREPARING', 'READY', 'DELIVERING'] 
                }
              }
            }
          }
        });
        
        // Статистика за текущий месяц
        const startOfMonth = new Date();
        startOfMonth.setDate(1);
        startOfMonth.setHours(0, 0, 0, 0);
        
        const monthlyDelivered = await prisma.order.count({
          where: { 
            courierId,
            statuses: {
              some: { 
                status: 'DELIVERED',
                createdAt: {
                  gte: startOfMonth
                }
              }
            }
          }
        });
        
        // Рейтинг выполнения (процент доставленных от общего количества назначенных)
        const deliveryRate = totalOrders > 0 ? (deliveredOrders / totalOrders * 100).toFixed(1) : '0';
        
        return {
          totalOrders,
          deliveredOrders,
          activeOrders,
          monthlyDelivered,
          deliveryRate: parseFloat(deliveryRate),
          efficiency: deliveredOrders > 0 ? 'Хорошая' : 'Новый курьер'
        };
      },
      10 * 60 * 1000 // 10 минут кэш
    );
    
    ApiResponseUtil.success(res, stats);
  } catch (error) {
    next(error);
  }
};

// Получить статистику курьера по ID (для админов)
export const getCourierStatsById = [
  validateParams(idSchema),
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const { id: courierId } = (req as any).validatedParams;
      
      // Проверяем, что пользователь является курьером
      const courier = await prisma.user.findUnique({
        where: { id: courierId },
        select: { 
          id: true, 
          role: true, 
          name: true, 
          phone_number: true,
          telegram_user_id: true
        }
      });
      
      if (!courier) {
        throw new AppError('Курьер не найден', 404);
      }
      
      if (courier.role !== 'COURIER') {
        throw new AppError('Указанный пользователь не является курьером', 400);
      }
      
      const cacheKey = `admin:courier:${courierId}:stats`;
      
      const stats = await cacheService.memoize(
        cacheKey,
        async () => {
          // Подсчитываем заказы по статусам
          const totalOrders = await prisma.order.count({
            where: { courierId }
          });
          
          const deliveredOrders = await prisma.order.count({
            where: { 
              courierId,
              statuses: {
                some: { status: 'DELIVERED' }
              }
            }
          });
          
          const activeOrders = await prisma.order.count({
            where: { 
              courierId,
              statuses: {
                some: { 
                  status: { 
                    in: ['CONFIRMED', 'PREPARING', 'READY', 'DELIVERING'] 
                  }
                }
              }
            }
          });
          
          const cancelledOrders = await prisma.order.count({
            where: { 
              courierId,
              statuses: {
                some: { status: 'CANCELLED' }
              }
            }
          });
          
          // Статистика за текущий месяц
          const startOfMonth = new Date();
          startOfMonth.setDate(1);
          startOfMonth.setHours(0, 0, 0, 0);
          
          const monthlyDelivered = await prisma.order.count({
            where: { 
              courierId,
              statuses: {
                some: { 
                  status: 'DELIVERED',
                  createdAt: {
                    gte: startOfMonth
                  }
                }
              }
            }
          });
          
          // Последний доставленный заказ
          const lastDelivery = await prisma.orderStatus.findFirst({
            where: { 
              status: 'DELIVERED',
              order: {
                courierId: courierId
              }
            },
            orderBy: { createdAt: 'desc' }
          });
          
          // Рейтинг выполнения
          const deliveryRateNum = totalOrders > 0 ? (deliveredOrders / totalOrders * 100) : 0;
          const deliveryRate = deliveryRateNum.toFixed(1);
          
          // Определяем эффективность
          let efficiency = 'Новый курьер';
          if (deliveredOrders >= 50) efficiency = 'Отличная';
          else if (deliveredOrders >= 20) efficiency = 'Хорошая';
          else if (deliveredOrders >= 5) efficiency = 'Средняя';
          
          return {
            totalOrders,
            deliveredOrders,
            activeOrders,
            cancelledOrders,
            monthlyStats: {
              delivered: monthlyDelivered,
              earnings: monthlyDelivered * 500 // Примерный заработок
            },
            averageDeliveryTime: 45.5,
            rating: Math.min(4.8, 3.5 + (deliveryRateNum / 25)),
            efficiency,
            deliveryRate: parseFloat(deliveryRate),
            lastDelivery: lastDelivery?.createdAt || null
          };
        },
        10 * 60 * 1000 // 10 минут кэш
      );
      
      ApiResponseUtil.success(res, {
        courier: {
          id: courier.id,
          telegram_user_id: courier.telegram_user_id,
          name: courier.name,
          phone: courier.phone_number
        },
        stats
      });
    } catch (error) {
      next(error);
    }
  }
];

// Получить детали заказа для курьера
export const getCourierOrder = [
  validateParams(idSchema),
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const { id: orderId } = (req as any).validatedParams;
      const courierId = req.user!.id;
      
      const cacheKey = `courier:${courierId}:order:${orderId}`;
      
      const order = await cacheService.memoize(
        cacheKey,
        async () => {
          const order = await prisma.order.findUnique({
            where: { 
              id: orderId,
              courierId // Курьер может видеть только свои заказы
            },
            include: {
              items: { 
                include: { 
                  product: {
                    select: { id: true, name: true, price: true, image: true }
                  }
                }
              },
              user: { 
                select: { 
                  id: true, 
                  telegram_user_id: true, 
                  name: true, 
                  phone_number: true 
                }
              },
              statuses: { 
                orderBy: { createdAt: 'asc' },
                select: { id: true, status: true, createdAt: true }
              }
            }
          });
          
          if (!order) {
            throw new AppError('Заказ не найден или не назначен вам', 404);
          }
          
          return {
            ...order,
            totalAmount: order.items.reduce((sum: number, item: any) => sum + (item.price || 0) * item.quantity, 0),
            currentStatus: order.statuses[order.statuses.length - 1]?.status || 'NEW'
          };
        },
        5 * 60 * 1000 // 5 минут кэш
      );
      
      ApiResponseUtil.success(res, order);
    } catch (error) {
      next(error);
    }
  }
];
