import prisma from '../lib/prisma';
import { AppError } from '../middlewares/errorHandler';
import { 
  PaginatedResponse, 
  PaginationOptions, 
  CreateStoreRequest, 
  UpdateStoreRequest,
  StoreFilter 
} from '../types';

export class StoreService {
  
  // Получить все магазины с пагинацией
  async getStores(
    pagination: PaginationOptions,
    filters: StoreFilter = {}
  ): Promise<PaginatedResponse<any>> {
    const { page = 1, limit = 10, sortBy = 'id', sortOrder = 'asc' } = pagination;
    const { search, ownerId } = filters;
    
    const skip = (page - 1) * limit;
    
    const whereClause: any = {};
    
    if (search) {
      whereClause.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { address: { contains: search, mode: 'insensitive' } }
      ];
    }
    
    if (ownerId) {
      whereClause.ownerId = ownerId;
    }
    
    const [stores, total] = await Promise.all([
      prisma.store.findMany({
        where: whereClause,
        skip,
        take: limit,
        orderBy: { [sortBy]: sortOrder },
        include: {
          owner: {
            select: {
              id: true,
              name: true,
              telegram_user_id: true,
              phone_number: true,
              role: true
            }
          },
          products: {
            take: 5, // Показываем только первые 5 товаров
            select: {
              id: true,
              name: true,
              price: true,
              image: true
            }
          },
          _count: {
            select: {
              products: true
            }
          }
        }
      }),
      prisma.store.count({ where: whereClause })
    ]);
    
    return {
      data: stores,
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit)
      }
    };
  }
  
  // Получить магазин по ID
  async getStoreById(storeId: number) {
    const store = await prisma.store.findUnique({
      where: { id: storeId },
      include: {
        owner: {
          select: {
            id: true,
            name: true,
            telegram_user_id: true,
            phone_number: true,
            role: true
          }
        },
        products: {
          select: {
            id: true,
            name: true,
            price: true,
            image: true,
            category: {
              select: {
                id: true,
                name: true
              }
            }
          }
        },
        _count: {
          select: {
            products: true
          }
        }
      }
    });
    
    if (!store) {
      throw new AppError('Магазин не найден', 404);
    }
    
    return store;
  }
  
  // Получить магазин по владельцу
  async getStoreByOwner(ownerId: number) {
    const store = await prisma.store.findUnique({
      where: { ownerId },
      include: {
        products: {
          select: {
            id: true,
            name: true,
            price: true,
            image: true,
            category: {
              select: {
                id: true,
                name: true
              }
            }
          }
        },
        _count: {
          select: {
            products: true
          }
        }
      }
    });
    
    return store;
  }
  
  // Создать магазин
  async createStore(data: CreateStoreRequest) {
    // Проверяем, что владелец существует и имеет роль SELLER
    if (data.ownerId) {
      const owner = await prisma.user.findUnique({
        where: { id: data.ownerId }
      });
      
      if (!owner) {
        throw new AppError('Пользователь не найден', 404);
      }
      
      if (owner.role !== 'SELLER') {
        throw new AppError('Пользователь должен иметь роль SELLER', 400);
      }
      
      // Проверяем, что у пользователя еще нет магазина
      const existingStore = await prisma.store.findUnique({
        where: { ownerId: data.ownerId }
      });
      
      if (existingStore) {
        throw new AppError('У этого пользователя уже есть магазин', 400);
      }
    }
    
    const store = await prisma.store.create({
      data: {
        name: data.name,
        address: data.address,
        ownerId: data.ownerId
      },
      include: {
        owner: {
          select: {
            id: true,
            name: true,
            telegram_user_id: true,
            phone_number: true,
            role: true
          }
        }
      }
    });
    
    return store;
  }
  
  // Обновить магазин
  async updateStore(
    storeId: number, 
    data: UpdateStoreRequest, 
    userId: number, 
    isAdmin: boolean
  ) {
    const store = await prisma.store.findUnique({
      where: { id: storeId },
      include: { owner: true }
    });
    
    if (!store) {
      throw new AppError('Магазин не найден', 404);
    }
    
    // Проверяем права доступа
    if (!isAdmin && store.ownerId !== userId) {
      throw new AppError('Доступ запрещен', 403);
    }
    
    const updatedStore = await prisma.store.update({
      where: { id: storeId },
      data: {
        ...(data.name && { name: data.name }),
        ...(data.address && { address: data.address })
      },
      include: {
        owner: {
          select: {
            id: true,
            name: true,
            telegram_user_id: true,
            phone_number: true,
            role: true
          }
        }
      }
    });
    
    return updatedStore;
  }
  
  // Назначить владельца магазина
  async assignOwner(storeId: number, ownerId: number) {
    const [store, owner] = await Promise.all([
      prisma.store.findUnique({ where: { id: storeId } }),
      prisma.user.findUnique({ where: { id: ownerId } })
    ]);
    
    if (!store) {
      throw new AppError('Магазин не найден', 404);
    }
    
    if (!owner) {
      throw new AppError('Пользователь не найден', 404);
    }
    
    if (owner.role !== 'SELLER') {
      throw new AppError('Пользователь должен иметь роль SELLER', 400);
    }
    
    // Проверяем, что у пользователя еще нет магазина
    const existingStore = await prisma.store.findUnique({
      where: { ownerId }
    });
    
    if (existingStore && existingStore.id !== storeId) {
      throw new AppError('У этого пользователя уже есть другой магазин', 400);
    }
    
    const updatedStore = await prisma.store.update({
      where: { id: storeId },
      data: { ownerId },
      include: {
        owner: {
          select: {
            id: true,
            name: true,
            telegram_user_id: true,
            phone_number: true,
            role: true
          }
        }
      }
    });
    
    return updatedStore;
  }
  
  // Удалить магазин
  async deleteStore(storeId: number) {
    const store = await prisma.store.findUnique({
      where: { id: storeId },
      include: {
        products: { select: { id: true } },
        _count: { select: { products: true } }
      }
    });
    
    if (!store) {
      throw new AppError('Магазин не найден', 404);
    }
    
    if (store._count.products > 0) {
      throw new AppError('Нельзя удалить магазин с товарами', 400);
    }
    
    await prisma.store.delete({
      where: { id: storeId }
    });
  }
  
  // Получить заказы для магазина
  async getStoreOrders(storeId: number, pagination: PaginationOptions) {
    const { page = 1, limit = 10, sortBy = 'createdAt', sortOrder = 'desc' } = pagination;
    const skip = (page - 1) * limit;
    
    const whereClause = {
      items: {
        some: {
          product: {
            storeId: storeId
          }
        }
      }
    };
    
    const [orders, total] = await Promise.all([
      prisma.order.findMany({
        where: whereClause,
        skip,
        take: limit,
        orderBy: { [sortBy]: sortOrder },
        include: {
          user: {
            select: {
              id: true,
              name: true,
              telegram_user_id: true,
              phone_number: true
            }
          },
          items: {
            where: {
              product: {
                storeId: storeId
              }
            },
            include: {
              product: {
                select: {
                  id: true,
                  name: true,
                  price: true,
                  image: true
                }
              },
              storeConfirmation: true
            }
          },
          statuses: {
            orderBy: { createdAt: 'desc' },
            select: {
              id: true,
              status: true,
              createdAt: true
            }
          }
        }
      }),
      prisma.order.count({ where: whereClause })
    ]);
    
    // Добавляем информацию о статусе и сумме заказа
    const ordersWithDetails = orders.map(order => {
      const storeItems = order.items;
      const storeTotal = storeItems.reduce((sum, item) => 
        sum + (item.quantity * (item.price || 0)), 0
      );
      
      return {
        ...order,
        currentStatus: order.statuses[0]?.status || null,
        storeTotal,
        storeItemsCount: storeItems.length
      };
    });
    
    return {
      data: ordersWithDetails,
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit)
      }
    };
  }

  // Получить элементы заказов для подтверждения магазином
  async getStoreOrderItems(
    storeId: number,
    pagination: PaginationOptions,
    filters: { status?: string; orderId?: number } = {}
  ): Promise<PaginatedResponse<any>> {
    const { page = 1, limit = 10, sortBy = 'createdAt', sortOrder = 'desc' } = pagination;
    const { status, orderId } = filters;
    
    const skip = (page - 1) * limit;
    
    const whereClause: any = {
      product: {
        storeId
      }
    };
    
    if (orderId) {
      whereClause.orderId = orderId;
    }
    
    if (status) {
      if (status === 'PENDING') {
        whereClause.storeConfirmation = null;
      } else {
        whereClause.storeConfirmation = {
          status
        };
      }
    }
    
    const [orderItems, total] = await Promise.all([
      prisma.orderItem.findMany({
        where: whereClause,
        skip,
        take: limit,
        orderBy: { [sortBy]: sortOrder },
        include: {
          order: {
            select: {
              id: true,
              address: true,
              createdAt: true,
              user: {
                select: {
                  id: true,
                  name: true,
                  telegram_user_id: true,
                  phone_number: true
                }
              },
              statuses: {
                orderBy: { createdAt: 'desc' },
                take: 1,
                select: {
                  status: true,
                  createdAt: true
                }
              }
            }
          },
          product: {
            select: {
              id: true,
              name: true,
              price: true,
              image: true
            }
          },
          storeConfirmation: {
            include: {
              confirmedBy: {
                select: {
                  id: true,
                  name: true,
                  telegram_user_id: true
                }
              }
            }
          }
        }
      }),
      prisma.orderItem.count({ where: whereClause })
    ]);
    
    // Добавляем статус подтверждения
    const itemsWithConfirmationStatus = orderItems.map(item => ({
      ...item,
      confirmationStatus: item.storeConfirmation?.status || 'PENDING',
      confirmedQuantity: item.storeConfirmation?.confirmedQuantity || null,
      confirmationNotes: item.storeConfirmation?.notes || null,
      confirmedAt: item.storeConfirmation?.confirmedAt || null,
      confirmedBy: item.storeConfirmation?.confirmedBy || null,
      currentOrderStatus: item.order.statuses[0]?.status || null
    }));
    
    return {
      data: itemsWithConfirmationStatus,
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit)
      }
    };
  }

  // Подтвердить наличие товара в заказе
  async confirmOrderItem(
    orderItemId: number,
    storeId: number,
    userId: number,
    confirmationData: {
      status: 'CONFIRMED' | 'PARTIAL' | 'REJECTED';
      confirmedQuantity?: number;
      notes?: string;
    }
  ) {
    const { status, confirmedQuantity, notes } = confirmationData;
    
    // Проверяем, что элемент заказа принадлежит этому магазину
    const orderItem = await prisma.orderItem.findFirst({
      where: {
        id: orderItemId,
        product: {
          storeId
        }
      },
      include: {
        product: true,
        order: {
          include: {
            statuses: {
              orderBy: { createdAt: 'desc' },
              take: 1
            }
          }
        },
        storeConfirmation: true
      }
    });
    
    if (!orderItem) {
      throw new AppError('Элемент заказа не найден или не принадлежит вашему магазину', 404);
    }
    
    // Проверяем, что заказ еще можно подтверждать
    const currentOrderStatus = orderItem.order.statuses[0]?.status;
    if (!currentOrderStatus || ['DELIVERED', 'CANCELLED'].includes(currentOrderStatus)) {
      throw new AppError('Нельзя подтверждать товары для завершенного или отмененного заказа', 400);
    }
    
    // Валидация количества
    if (status === 'CONFIRMED' && confirmedQuantity !== orderItem.quantity) {
      throw new AppError('При полном подтверждении количество должно совпадать с заказанным', 400);
    }
    
    if (status === 'PARTIAL') {
      if (!confirmedQuantity || confirmedQuantity <= 0 || confirmedQuantity >= orderItem.quantity) {
        throw new AppError('При частичном подтверждении количество должно быть больше 0 и меньше заказанного', 400);
      }
    }
    
    if (status === 'REJECTED' && confirmedQuantity && confirmedQuantity > 0) {
      throw new AppError('При отклонении подтвержденное количество должно быть 0', 400);
    }
    
    // Создаем или обновляем подтверждение
    const confirmation = await prisma.storeOrderConfirmation.upsert({
      where: {
        orderItemId
      },
      create: {
        orderItemId,
        storeId,
        status,
        confirmedQuantity: status === 'REJECTED' ? 0 : (confirmedQuantity || orderItem.quantity),
        notes,
        confirmedAt: new Date(),
        confirmedById: userId
      },
      update: {
        status,
        confirmedQuantity: status === 'REJECTED' ? 0 : (confirmedQuantity || orderItem.quantity),
        notes,
        confirmedAt: new Date(),
        confirmedById: userId
      },
      include: {
        orderItem: {
          include: {
            product: true,
            order: {
              select: {
                id: true,
                address: true,
                user: {
                  select: {
                    id: true,
                    name: true,
                    telegram_user_id: true,
                    phone_number: true
                  }
                }
              }
            }
          }
        },
        confirmedBy: {
          select: {
            id: true,
            name: true,
            telegram_user_id: true
          }
        }
      }
    });
    
    return confirmation;
  }

  // Получить статистику подтверждений для магазина
  async getStoreConfirmationStats(storeId: number) {
    const [
      totalItems,
      pendingItems,
      confirmedItems,
      partialItems,
      rejectedItems,
      todayConfirmations
    ] = await Promise.all([
      prisma.orderItem.count({
        where: {
          product: { storeId }
        }
      }),
      prisma.orderItem.count({
        where: {
          product: { storeId },
          storeConfirmation: null
        }
      }),
      prisma.storeOrderConfirmation.count({
        where: {
          storeId,
          status: 'CONFIRMED'
        }
      }),
      prisma.storeOrderConfirmation.count({
        where: {
          storeId,
          status: 'PARTIAL'
        }
      }),
      prisma.storeOrderConfirmation.count({
        where: {
          storeId,
          status: 'REJECTED'
        }
      }),
      prisma.storeOrderConfirmation.count({
        where: {
          storeId,
          confirmedAt: {
            gte: new Date(new Date().setHours(0, 0, 0, 0))
          }
        }
      })
    ]);
    
    return {
      totalItems,
      pendingItems,
      confirmedItems,
      partialItems,
      rejectedItems,
      todayConfirmations,
      confirmationRate: totalItems > 0 ? Math.round(((confirmedItems + partialItems) / totalItems) * 100) : 0
    };
  }
}
