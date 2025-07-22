import prisma from '../lib/prisma';
import { AppError } from '../middlewares/errorHandler';
import { 
  CreateOrderRequest, 
  OrderFilter, 
  PaginationOptions,
  PaginatedResponse,
  OrderStatus 
} from '../types';
import { PaginationUtil, FilterUtil } from '../utils/apiResponse';

export class OrderService {
  async createOrder(userId: number, data: CreateOrderRequest) {
    // Проверяем все товары и их наличие
    const productIds = data.items.map(item => item.productId);
    const products = await prisma.product.findMany({
      where: { id: { in: productIds } },
      select: { id: true, name: true, price: true }
    });

    if (products.length !== productIds.length) {
      throw new AppError('Некоторые товары не найдены', 400);
    }

    // Проверяем остатки товаров
    const stockPromises = productIds.map(async (productId) => {
      const movements = await prisma.stockMovement.findMany({
        where: { productId },
        select: { quantity: true, type: true }
      });

      const stock = movements.reduce((sum, movement) => {
        return movement.type === 'INCOME' 
          ? sum + movement.quantity 
          : sum - movement.quantity;
      }, 0);

      const requiredQuantity = data.items.find(item => item.productId === productId)?.quantity || 0;
      
      if (stock < requiredQuantity) {
        throw new AppError(`Недостаточно товара на складе: ${products.find(p => p.id === productId)?.name}`, 400);
      }

      return { productId, stock };
    });

    await Promise.all(stockPromises);

    // Создаем заказ в транзакции
    const order = await prisma.$transaction(async (tx) => {
      // Создаем заказ
      const newOrder = await tx.order.create({
        data: {
          userId,
          address: data.address.trim()
        }
      });

      // Создаем элементы заказа
      const orderItems = await Promise.all(
        data.items.map(async (item) => {
          const product = products.find(p => p.id === item.productId);
          return tx.orderItem.create({
            data: {
              orderId: newOrder.id,
              productId: item.productId,
              quantity: item.quantity,
              price: item.price || product!.price
            }
          });
        })
      );

      // Создаем начальный статус
      await tx.orderStatus.create({
        data: {
          orderId: newOrder.id,
          status: OrderStatus.PENDING
        }
      });

      // Списываем товары со склада
      await Promise.all(
        data.items.map(item =>
          tx.stockMovement.create({
            data: {
              productId: item.productId,
              quantity: item.quantity,
              type: 'OUTCOME',
              adminId: userId // В реальном приложении нужно передавать админа
            }
          })
        )
      );

      return { ...newOrder, items: orderItems };
    });

    return this.getOrderById(order.id, userId, false);
  }

  async getOrders(
    pagination: PaginationOptions,
    userId?: number, 
    filters: OrderFilter = {}, 
    isAdmin: boolean = false
  ): Promise<PaginatedResponse<any>> {
    const { skip, take } = PaginationUtil.getSkipTake(pagination.page, pagination.limit);
    
    const whereClause: any = {};
    
    // Обычные пользователи видят только свои заказы
    if (!isAdmin && userId) {
      whereClause.userId = userId;
    }
    
    // Фильтр по пользователю для админов
    if (isAdmin && filters.userId) {
      whereClause.userId = filters.userId;
    }
    
    // Фильтр по статусу
    if (filters.status) {
      whereClause.statuses = {
        some: { status: filters.status }
      };
    }
    
    // Фильтр по дате
    if (filters.dateFrom) {
      whereClause.createdAt = {
        gte: filters.dateFrom
      };
    }
    
    if (filters.dateTo) {
      whereClause.createdAt = {
        ...whereClause.createdAt,
        lte: filters.dateTo
      };
    }

    const orderBy = PaginationUtil.buildOrderBy(pagination.sortBy, pagination.sortOrder);

    const [orders, total] = await Promise.all([
      prisma.order.findMany({
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
            orderBy: { createdAt: 'desc' },
            take: 1,
            select: { status: true, createdAt: true }
          }
        },
        orderBy,
        skip,
        take
      }),
      prisma.order.count({ where: whereClause })
    ]);

    const ordersWithDetails = orders.map(order => ({
      ...order,
      totalAmount: order.items.reduce((sum, item) => sum + (item.quantity * (item.price || 0)), 0),
      status: order.statuses[0]?.status || OrderStatus.PENDING,
      statusUpdatedAt: order.statuses[0]?.createdAt || order.createdAt,
      itemsCount: order.items.length
    }));

    return {
      data: ordersWithDetails,
      meta: {
        page: pagination.page,
        limit: pagination.limit,
        total,
        totalPages: Math.ceil(total / pagination.limit)
      }
    };
  }

  async getOrderById(orderId: number, userId?: number, isAdmin: boolean = false) {
    const whereClause: any = { id: orderId };
    
    // Обычные пользователи могут видеть только свои заказы
    if (!isAdmin && userId) {
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

    return {
      ...order,
      totalAmount: order.items.reduce((sum, item) => sum + (item.quantity * (item.price || 0)), 0),
      currentStatus: order.statuses[order.statuses.length - 1]?.status || OrderStatus.PENDING
    };
  }

  async updateOrderStatus(orderId: number, status: string) {
    // Проверяем существование заказа
    const order = await prisma.order.findUnique({
      where: { id: orderId }
    });

    if (!order) {
      throw new AppError('Заказ не найден', 404);
    }

    // Проверяем валидность статуса
    if (!Object.values(OrderStatus).includes(status as OrderStatus)) {
      throw new AppError('Неверный статус заказа', 400);
    }

    return prisma.orderStatus.create({
      data: {
        orderId,
        status
      }
    });
  }

  async getOrderStatuses(orderId: number) {
    const order = await prisma.order.findUnique({
      where: { id: orderId }
    });

    if (!order) {
      throw new AppError('Заказ не найден', 404);
    }

    return prisma.orderStatus.findMany({
      where: { orderId },
      orderBy: { createdAt: 'asc' },
      select: { id: true, status: true, createdAt: true }
    });
  }
}
