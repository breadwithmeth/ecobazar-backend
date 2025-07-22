import { Request, Response, NextFunction } from 'express';
import { AuthRequest } from '../middlewares/auth';
import { AppError } from '../middlewares/errorHandler';
import { ApiResponseUtil } from '../utils/apiResponse';
import { PaginationUtil } from '../utils/pagination';
import prisma from '../lib/prisma';

// Получить заказы курьера
export const getCourierOrders = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { page, limit, sortBy, sortOrder } = PaginationUtil.parseQuery(req.query);
    const { skip, take } = PaginationUtil.getSkipTake(page, limit);
    
    const statusFilter = req.query.status as string;
    const whereClause: any = {
      courierId: req.user!.id
    };
    
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
          select: { id: true, status: true, createdAt: true },
          take: 1
        }
      }
    });

    // Добавляем текущий статус
    const ordersWithStatus = orders.map(order => ({
      ...order,
      currentStatus: order.statuses[0]?.status || 'NEW',
      totalAmount: order.items.reduce((sum, item) => sum + (item.price || 0) * item.quantity, 0)
    }));

    const meta = PaginationUtil.buildMeta(total, page, limit);
    
    ApiResponseUtil.success(res, { orders: ordersWithStatus, meta });
  } catch (error) {
    next(error);
  }
};

// Обновить статус заказа курьером
export const updateOrderStatusByCourier = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const orderId = parseInt(req.params.id);
    const { status } = req.body;
    
    if (!orderId) {
      throw new AppError('ID заказа обязателен', 400);
    }
    
    // Проверяем, что заказ назначен этому курьеру
    const order = await prisma.order.findUnique({
      where: { id: orderId },
      select: { 
        id: true, 
        courierId: true,
        statuses: {
          orderBy: { createdAt: 'desc' },
          take: 1
        }
      }
    });
    
    if (!order) {
      throw new AppError('Заказ не найден', 404);
    }
    
    if (order.courierId !== req.user!.id) {
      throw new AppError('Заказ не назначен вам', 403);
    }
    
    const currentStatus = order.statuses[0]?.status;
    
    // Курьер может менять статус только на "DELIVERED" и только если заказ в статусе "DELIVERING"
    if (status !== 'DELIVERED') {
      throw new AppError('Курьер может изменить статус только на "DELIVERED"', 400);
    }
    
    if (currentStatus !== 'DELIVERING') {
      throw new AppError('Можно отметить доставленным только заказ в статусе "DELIVERING"', 400);
    }
    
    // Создаем новый статус
    await prisma.orderStatus.create({
      data: {
        orderId,
        status
      }
    });
    
    // Получаем обновленный заказ
    const updatedOrder = await prisma.order.findUnique({
      where: { id: orderId },
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
    
    ApiResponseUtil.success(res, updatedOrder, 'Статус заказа успешно обновлен');
  } catch (error) {
    next(error);
  }
};

// Назначить курьера на заказ (только для админов)
export const assignCourierToOrder = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { orderId, courierId } = req.body;
    
    if (!orderId || !courierId) {
      throw new AppError('orderId и courierId обязательны', 400);
    }
    
    // Проверяем существование заказа
    const order = await prisma.order.findUnique({
      where: { id: orderId },
      select: { id: true, courierId: true }
    });
    
    if (!order) {
      throw new AppError('Заказ не найден', 404);
    }
    
    // Проверяем существование курьера
    const courier = await prisma.user.findUnique({
      where: { id: courierId },
      select: { id: true, role: true, name: true }
    });
    
    if (!courier) {
      throw new AppError('Курьер не найден', 404);
    }
    
    if (courier.role !== 'COURIER') {
      throw new AppError('Указанный пользователь не является курьером', 400);
    }
    
    // Назначаем курьера
    const updatedOrder = await prisma.order.update({
      where: { id: orderId },
      data: { courierId },
      include: {
        courier: {
          select: { id: true, name: true, phone_number: true }
        },
        items: { 
          include: { 
            product: {
              select: { id: true, name: true, price: true }
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
        }
      }
    });
    
    ApiResponseUtil.success(res, updatedOrder, 'Курьер успешно назначен на заказ');
  } catch (error) {
    next(error);
  }
};

// Получить список всех курьеров (для админов)
export const getCouriers = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { page, limit } = PaginationUtil.parseQuery(req.query);
    const { skip, take } = PaginationUtil.getSkipTake(page, limit);
    
    const total = await prisma.user.count({
      where: { role: 'COURIER' }
    });
    
    const couriers = await prisma.user.findMany({
      where: { role: 'COURIER' },
      skip,
      take,
      select: {
        id: true,
        name: true,
        phone_number: true,
        telegram_user_id: true,
        _count: {
          select: {
            deliveredOrders: true
          }
        }
      },
      orderBy: { name: 'asc' }
    });
    
    const meta = PaginationUtil.buildMeta(total, page, limit);
    
    ApiResponseUtil.success(res, { couriers, meta });
  } catch (error) {
    next(error);
  }
};

// Получить статистику курьера
export const getCourierStats = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const courierId = req.user!.id;
    
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
    
    const stats = {
      totalOrders,
      deliveredOrders,
      activeOrders,
      deliveryRate: totalOrders > 0 ? Math.round((deliveredOrders / totalOrders) * 100) : 0
    };
    
    ApiResponseUtil.success(res, stats);
  } catch (error) {
    next(error);
  }
};
