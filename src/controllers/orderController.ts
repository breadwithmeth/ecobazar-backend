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

export const getOrdersReport = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    // Парсинг и валидация query
    const allowedStatuses = ['NEW', 'WAITING_PAYMENT', 'PREPARING', 'DELIVERING', 'DELIVERED', 'CANCELLED'];
    const now = new Date();
    const defaultFrom = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000); // 30 дней назад
    const fromStr = (req.query.from as string) || defaultFrom.toISOString();
    const toStr = (req.query.to as string) || now.toISOString();

    const from = new Date(fromStr);
    const to = new Date(toStr);
    if (isNaN(from.getTime()) || isNaN(to.getTime())) {
      throw new AppError('Неверный формат from/to. Используйте ISO дату.', 400);
    }

    const storeId = req.query.storeId ? parseInt(req.query.storeId as string) : undefined;
    const courierId = req.query.courierId ? parseInt(req.query.courierId as string) : undefined;
    const status = req.query.status as string | undefined;
    const deliveryType = req.query.deliveryType as 'ASAP' | 'SCHEDULED' | undefined;
    const groupBy = ((req.query.groupBy as string) || 'day').toLowerCase(); // day | month

    if (status && !allowedStatuses.includes(status)) {
      throw new AppError(`Недопустимый статус. Разрешены: ${allowedStatuses.join(', ')}`, 400);
    }
    if (storeId !== undefined && (isNaN(storeId) || storeId <= 0)) {
      throw new AppError('storeId должен быть положительным числом', 400);
    }
    if (courierId !== undefined && (isNaN(courierId) || courierId <= 0)) {
      throw new AppError('courierId должен быть положительным числом', 400);
    }
    if (deliveryType && !['ASAP', 'SCHEDULED'].includes(deliveryType)) {
      throw new AppError('deliveryType должен быть ASAP или SCHEDULED', 400);
    }

    // Where
    const where: any = {
      createdAt: { gte: from, lte: to }
    };
    if (storeId) {
      where.items = { some: { product: { storeId } } };
    }
    if (courierId) where.courierId = courierId;
    if (status) {
      where.statuses = { some: { status } };
    }
    if (deliveryType) where.deliveryType = deliveryType;

    const orders = await prisma.order.findMany({
      where,
      orderBy: { createdAt: 'asc' },
      include: {
        items: {
          select: {
            quantity: true,
            price: true,
            product: {
              select: {
                id: true,
                name: true,
                storeId: true,
                store: { select: { id: true, name: true } }
              }
            }
          }
        },
        courier: { select: { id: true, name: true } },
        statuses: { orderBy: { createdAt: 'desc' }, take: 1, select: { status: true } }
      }
    });

    // Агрегации
    const totals = { orders: orders.length, revenue: 0, items: 0, aov: 0 };
    const byStatus = new Map<string, number>();
    const byStore = new Map<number, { storeId: number; storeName: string; orders: Set<number>; revenue: number; items: number }>();
    const byCourier = new Map<string, { courierId: number | null; courierName: string; orders: number; revenue: number }>();
    const daily = new Map<string, { date: string; orders: number; revenue: number }>();

    for (const order of orders as any[]) {
      const orderRevenue = order.items.reduce((sum: number, it: any) => sum + (it.quantity * (it.price || 0)), 0);
      const orderItems = order.items.reduce((sum: number, it: any) => sum + it.quantity, 0);
      totals.revenue += orderRevenue;
      totals.items += orderItems;

      // Статус (текущий)
      const st = order.statuses[0]?.status || 'UNKNOWN';
      byStatus.set(st, (byStatus.get(st) || 0) + 1);

      // По дням/месяцам
      const d = new Date(order.createdAt);
      const key = groupBy === 'month'
        ? `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`
        : `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`;
      const dayEntry = daily.get(key) || { date: key, orders: 0, revenue: 0 };
      dayEntry.orders += 1;
      dayEntry.revenue += orderRevenue;
      daily.set(key, dayEntry);

      // По магазинам
      const storesSeen = new Set<number>();
      for (const it of order.items) {
        const sId = it.product.storeId;
        const name = it.product.store?.name || `Store ${sId}`;
        const entry = byStore.get(sId) || { storeId: sId, storeName: name, orders: new Set<number>(), revenue: 0, items: 0 };
        entry.revenue += (it.quantity * (it.price || 0));
        entry.items += it.quantity;
        if (!storesSeen.has(sId)) {
          entry.orders.add(order.id);
          storesSeen.add(sId);
        }
        byStore.set(sId, entry);
      }

      // По курьерам
      const cKey = order.courier ? String(order.courier.id) : 'null';
      const cEntry = byCourier.get(cKey) || { courierId: order.courier ? order.courier.id : null, courierName: order.courier?.name || 'Не назначен', orders: 0, revenue: 0 };
      cEntry.orders += 1;
      cEntry.revenue += orderRevenue;
      byCourier.set(cKey, cEntry);
    }

    totals.aov = totals.orders > 0 ? Number((totals.revenue / totals.orders).toFixed(2)) : 0;

    const response = {
      range: { from: from.toISOString(), to: to.toISOString() },
      filters: { storeId, courierId, status, deliveryType, groupBy },
      totals,
      byStatus: Array.from(byStatus.entries()).map(([status, count]) => ({ status, count })).sort((a, b) => b.count - a.count),
      byStore: Array.from(byStore.values()).map(e => ({ storeId: e.storeId, storeName: e.storeName, orders: e.orders.size, revenue: Number(e.revenue.toFixed(2)), items: e.items })).sort((a, b) => b.revenue - a.revenue),
      byCourier: Array.from(byCourier.values()).map(e => ({ courierId: e.courierId, courierName: e.courierName, orders: e.orders, revenue: Number(e.revenue.toFixed(2)) })).sort((a, b) => b.revenue - a.revenue),
      daily: Array.from(daily.values()).sort((a, b) => a.date.localeCompare(b.date))
    };

    ApiResponseUtil.success(res, response);
  } catch (error) {
    next(error);
  }
};
