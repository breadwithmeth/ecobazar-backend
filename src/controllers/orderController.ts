import { Request, Response, NextFunction } from 'express';
import prisma from '../lib/prisma';
import { AppError } from '../middlewares/errorHandler';
import { ApiResponseUtil, PaginationUtil } from '../utils/apiResponse';
import { AuthRequest } from '../middlewares/auth';
import { telegramService } from '../services/telegramService';

// Получить все заказы (только для ADMIN)
export const getAllOrders = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { page, limit, sortBy, sortOrder } = PaginationUtil.parseQuery(req.query);
    const { skip, take } = PaginationUtil.getSkipTake(page, limit);
    
    // Фильтрация по статусу
    const statusFilter = req.query.status as string;
    const whereClause: any = {};
    
    if (statusFilter) {
      whereClause.statuses = {
        some: {
          status: statusFilter
        }
      };
    }
    
    const total = await prisma.order.count({ where: whereClause });
    
    const orders = await prisma.order.findMany({
      where: whereClause,
      skip,
      take,
      orderBy: PaginationUtil.buildOrderBy(sortBy || 'createdAt', sortOrder || 'desc'), // Сортировка: новые заказы первыми
      include: {
        items: { 
          include: { 
            product: {
              select: { id: true, name: true, price: true, image: true }
            },
            storeConfirmation: {
              select: {
                id: true,
                status: true,
                confirmedQuantity: true,
                confirmedAt: true,
                notes: true,
                store: {
                  select: { id: true, name: true }
                },
                confirmedBy: {
                  select: { id: true, name: true }
                }
              }
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
        courier: {
          select: {
            id: true,
            name: true,
            telegram_user_id: true,
            phone_number: true
          }
        },
        statuses: { 
          orderBy: { createdAt: 'desc' },
          select: { id: true, status: true, createdAt: true }
        }
      }
    });
    
    // Добавляем общую сумму и текущий статус к каждому заказу
    const ordersWithDetails = orders.map((order: any) => {
      const totalAmount = order.items.reduce((sum: number, item: any) => sum + (item.quantity * (item.price || 0)), 0);
      
      // Подсчитываем статистику подтверждений
      const confirmationStats = {
        pending: 0,
        confirmed: 0,
        partial: 0,
        rejected: 0,
        total: order.items.length
      };
      
      order.items.forEach((item: any) => {
        if (item.storeConfirmation) {
          switch (item.storeConfirmation.status) {
            case 'PENDING':
              confirmationStats.pending++;
              break;
            case 'CONFIRMED':
              confirmationStats.confirmed++;
              break;
            case 'PARTIAL':
              confirmationStats.partial++;
              break;
            case 'REJECTED':
              confirmationStats.rejected++;
              break;
          }
        } else {
          confirmationStats.pending++;
        }
      });
      
      return {
        ...order,
        deliveryType: order.deliveryType,
        scheduledDate: order.scheduledDate,
        totalAmount,
        currentStatus: order.statuses[0]?.status || null,
        itemsCount: order.items.length,
        confirmationStats
      };
    });
    
    ApiResponseUtil.paginated(res, ordersWithDetails, { 
      page: page || 1, 
      limit: limit || 10, 
      total 
    });
  } catch (error) {
    next(error);
  }
};

export const createOrder = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { items, address, deliveryType = 'ASAP', scheduledDate } = req.body;
    const userId = req.user!.id;
    
    // Дополнительная валидация для запланированной доставки
    if (deliveryType === 'SCHEDULED' && !scheduledDate) {
      throw new AppError('При выборе запланированной доставки необходимо указать дату и время', 400);
    }
    
    // Проверяем все товары и их наличие
    const productIds = items.map((item: any) => item.productId);
    const products = await prisma.product.findMany({
      where: { id: { in: productIds } },
      select: { id: true, name: true, price: true }
    });
    
    if (products.length !== productIds.length) {
      throw new AppError('Некоторые товары не найдены', 400);
    }
    
    // Проверяем остатки товаров
    const movements = await prisma.stockMovement.findMany({
      where: { productId: { in: productIds } },
      select: { productId: true, type: true, quantity: true }
    });
    
    const stockMap = new Map<number, number>();
    for (const movement of movements) {
      const current = stockMap.get(movement.productId) || 0;
      const change = movement.type === 'INCOME' ? movement.quantity : -movement.quantity;
      stockMap.set(movement.productId, current + change);
    }
    
    // Проверяем, что всех товаров достаточно
    for (const item of items) {
      const availableStock = stockMap.get(item.productId) || 0;
      if (availableStock < item.quantity) {
        const product = products.find(p => p.id === item.productId);
        throw new AppError(`Недостаточно товара "${product?.name}" на складе. Доступно: ${availableStock}`, 400);
      }
    }
    
    // Создаем заказ в транзакции с увеличенным таймаутом
    const result = await prisma.$transaction(async (tx) => {
      // Создаем заказ
      const order = await tx.order.create({
        data: {
          userId,
          address: address.trim(),
          deliveryType,
          scheduledDate: deliveryType === 'SCHEDULED' ? scheduledDate : null,
          items: {
            create: items.map((item: any) => {
              const product = products.find(p => p.id === item.productId)!;
              return {
                productId: item.productId,
                quantity: item.quantity,
                price: product.price // Фиксируем цену на момент заказа
              };
            })
          }
        },
        include: { 
          items: { 
            include: { 
              product: {
                select: { id: true, name: true, image: true }
              }
            }
          }
        }
      });
      
      // Создаем начальный статус заказа
      await tx.orderStatus.create({
        data: {
          orderId: order.id,
          status: 'NEW'
        }
      });

      // Создаем записи для подтверждения магазинами и списываем товары параллельно
      const [productsWithStores] = await Promise.all([
        tx.product.findMany({
          where: { id: { in: items.map((item: any) => item.productId) } },
          select: { id: true, storeId: true }
        })
      ]);

      // Создаем подтверждения и движения склада параллельно
      await Promise.all([
        // Создаем записи для подтверждения магазинами
        ...order.items.map(async (orderItem: any) => {
          const product = productsWithStores.find(p => p.id === orderItem.productId);
          if (product) {
            return tx.storeOrderConfirmation.create({
              data: {
                orderItemId: orderItem.id,
                storeId: product.storeId,
                status: 'PENDING'
              }
            });
          }
        }),
        // Списываем товары со склада
        ...items.map((item: any) =>
          tx.stockMovement.create({
            data: {
              productId: item.productId,
              quantity: item.quantity,
              type: 'OUTCOME',
              adminId: userId // Записываем, кто сделал заказ
            }
          })
        )
      ]);
      
      return order;
    }, {
      timeout: 15000 // Увеличиваем таймаут до 15 секунд
    });
    
    // Добавляем общую сумму заказа
    const orderWithTotal = {
      ...result,
      totalAmount: result.items.reduce((sum, item) => sum + (item.quantity * (item.price || 0)), 0),
      status: 'NEW'
    };

    // Отправляем Telegram уведомления продавцам асинхронно
    setImmediate(async () => {
      try {
        await telegramService.sendNewOrderNotifications(result.id);
      } catch (error) {
        console.error('Ошибка отправки Telegram уведомлений:', error);
      }
    });
    
    ApiResponseUtil.created(res, orderWithTotal, 'Заказ успешно создан');
  } catch (error) {
    next(error);
  }
};

export const getOrders = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const userId = req.user!.id;
    const { page, limit } = PaginationUtil.parseQuery(req.query);
    const { skip, take } = PaginationUtil.getSkipTake(page, limit);
    
    // Получаем заказы пользователя, исключая доставленные
    const whereClause = {
      userId,
      statuses: {
        every: {
          status: { not: 'DELIVERED' }
        }
      }
    };
    
    const total = await prisma.order.count({ where: whereClause });
    
    const orders = await prisma.order.findMany({
      where: whereClause,
      skip,
      take,
      orderBy: { createdAt: 'desc' }, // Новые заказы первыми
      include: {
        items: { 
          include: { 
            product: {
              select: { id: true, name: true, price: true, image: true }
            }
          }
        },
        statuses: { 
          orderBy: { createdAt: 'desc' }, 
          take: 1,
          select: { status: true, createdAt: true }
        }
      }
    });
    
    // Для каждого заказа возвращаем только последний статус и общую сумму
    const result = orders.map(order => ({
      id: order.id,
      address: order.address,
      createdAt: order.createdAt,
      deliveryType: order.deliveryType,
      scheduledDate: order.scheduledDate,
      items: order.items,
      totalAmount: order.items.reduce((sum, item) => sum + (item.quantity * (item.price || 0)), 0),
      status: order.statuses[0]?.status || null,
      statusUpdatedAt: order.statuses[0]?.createdAt || order.createdAt,
      itemsCount: order.items.length
    }));
    
    ApiResponseUtil.paginated(res, result, { 
      page: page || 1, 
      limit: limit || 10, 
      total 
    });
  } catch (error) {
    next(error);
  }
};

export const getOrder = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const orderId = parseInt(id);
    const userId = req.user!.id;
    const isAdmin = req.user!.role === 'ADMIN';
    
    if (isNaN(orderId)) {
      throw new AppError('Неверный ID заказа', 400);
    }
    
    const whereClause: any = { id: orderId };
    
    // Обычные пользователи могут видеть только свои заказы
    if (!isAdmin) {
      whereClause.userId = userId;
    }
    
    const order = await prisma.order.findUnique({
      where: whereClause,
      include: {
        items: { 
          include: { 
            product: {
              select: { id: true, name: true, price: true, image: true }
            },
            storeConfirmation: isAdmin ? {
              select: {
                id: true,
                status: true,
                confirmedQuantity: true,
                confirmedAt: true,
                notes: true,
                store: {
                  select: { id: true, name: true }
                },
                confirmedBy: {
                  select: { id: true, name: true }
                }
              }
            } : undefined
          }
        },
        user: isAdmin ? { 
          select: { 
            id: true, 
            telegram_user_id: true, 
            name: true, 
            phone_number: true 
          }
        } : undefined,
        statuses: { 
          orderBy: { createdAt: 'asc' },
          select: { id: true, status: true, createdAt: true }
        }
      }
    });
    
    if (!order) {
      throw new AppError('Заказ не найден', 404);
    }
    
    // Добавляем информацию о подтверждениях для админов
    let confirmationStats;
    if (isAdmin && order.items) {
      confirmationStats = {
        pending: 0,
        confirmed: 0,
        partial: 0,
        rejected: 0,
        total: order.items.length
      };
      
      (order as any).items.forEach((item: any) => {
        if (item.storeConfirmation) {
          switch (item.storeConfirmation.status) {
            case 'PENDING':
              confirmationStats!.pending++;
              break;
            case 'CONFIRMED':
              confirmationStats!.confirmed++;
              break;
            case 'PARTIAL':
              confirmationStats!.partial++;
              break;
            case 'REJECTED':
              confirmationStats!.rejected++;
              break;
          }
        } else {
          confirmationStats!.pending++;
        }
      });
    }
    
    const orderWithDetails = {
      ...order,
      deliveryType: order.deliveryType,
      scheduledDate: order.scheduledDate,
      totalAmount: (order as any).items.reduce((sum: number, item: any) => sum + (item.quantity * (item.price || 0)), 0),
      currentStatus: (order as any).statuses[(order as any).statuses.length - 1]?.status || null,
      itemsCount: (order as any).items.length,
      ...(isAdmin && confirmationStats ? { confirmationStats } : {})
    };
    
    ApiResponseUtil.success(res, orderWithDetails);
  } catch (error) {
    next(error);
  }
};
