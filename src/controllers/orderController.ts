import { Request, Response, NextFunction } from 'express';
import prisma from '../lib/prisma';
import { AppError } from '../middlewares/errorHandler';
import { ApiResponseUtil, PaginationUtil } from '../utils/apiResponse';
import { AuthRequest } from '../middlewares/auth';

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
      orderBy: PaginationUtil.buildOrderBy(sortBy || 'createdAt', sortOrder || 'desc'),
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
          select: { id: true, status: true, createdAt: true }
        }
      }
    });
    
    // Добавляем общую сумму и текущий статус к каждому заказу
    const ordersWithDetails = orders.map(order => ({
      ...order,
      totalAmount: order.items.reduce((sum, item) => sum + (item.quantity * (item.price || 0)), 0),
      currentStatus: order.statuses[0]?.status || null,
      itemsCount: order.items.length
    }));
    
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
    const { items, address } = req.body;
    const userId = req.user!.id;
    
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
    
    // Создаем заказ в транзакции
    const result = await prisma.$transaction(async (tx) => {
      // Создаем заказ
      const order = await tx.order.create({
        data: {
          userId,
          address: address.trim(),
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
      
      // Списываем товары со склада
      for (const item of items) {
        await tx.stockMovement.create({
          data: {
            productId: item.productId,
            quantity: item.quantity,
            type: 'OUTCOME',
            adminId: userId // Записываем, кто сделал заказ
          }
        });
      }
      
      return order;
    });
    
    // Добавляем общую сумму заказа
    const orderWithTotal = {
      ...result,
      totalAmount: result.items.reduce((sum, item) => sum + (item.quantity * (item.price || 0)), 0),
      status: 'NEW'
    };
    
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
      orderBy: { createdAt: 'desc' },
      include: {
        items: { 
          include: { 
            product: {
              select: { id: true, name: true, image: true }
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
            }
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
    
    const orderWithDetails = {
      ...order,
      totalAmount: order.items.reduce((sum, item) => sum + (item.quantity * (item.price || 0)), 0),
      currentStatus: order.statuses[order.statuses.length - 1]?.status || null,
      itemsCount: order.items.length
    };
    
    ApiResponseUtil.success(res, orderWithDetails);
  } catch (error) {
    next(error);
  }
};
