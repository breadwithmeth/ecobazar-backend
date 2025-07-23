import { Request, Response, NextFunction } from 'express';
import { PrismaClient } from '@prisma/client';
import { AuthRequest } from '../middlewares/auth';
import { ApiResponseUtil, PaginationUtil } from '../utils/apiResponse';
import { AppError } from '../middlewares/errorHandler';

const prisma = new PrismaClient();

// Получить всех пользователей (только для администраторов)
export const getAllUsers = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { page, limit, sortBy, sortOrder } = PaginationUtil.parseQuery(req.query);
    const { skip, take } = PaginationUtil.getSkipTake(page, limit);
    
    // Фильтрация по роли
    const roleFilter = req.query.role as string;
    const searchFilter = req.query.search as string;
    
    const whereClause: any = {};
    
    if (roleFilter) {
      whereClause.role = roleFilter;
    }
    
    if (searchFilter) {
      whereClause.OR = [
        { name: { contains: searchFilter, mode: 'insensitive' } },
        { phone_number: { contains: searchFilter } },
        { telegram_user_id: { contains: searchFilter } }
      ];
    }
    
    const total = await prisma.user.count({ where: whereClause });
    
    const users = await prisma.user.findMany({
      where: whereClause,
      skip,
      take,
      orderBy: PaginationUtil.buildOrderBy(sortBy || 'id', sortOrder || 'desc'),
      select: {
        id: true,
        telegram_user_id: true,
        name: true,
        phone_number: true,
        role: true,
        _count: {
          select: {
            orders: true,
            deliveredOrders: true
          }
        }
      }
    });
    
    // Добавляем дополнительную статистику для курьеров
    const usersWithStats = await Promise.all(
      users.map(async (user) => {
        if (user.role === 'COURIER') {
          const activeOrders = await prisma.order.count({
            where: { 
              courierId: user.id,
              statuses: {
                some: { 
                  status: { 
                    in: ['WAITING_PAYMENT', 'PREPARING', 'DELIVERING'] 
                  }
                }
              }
            }
          });
          
          return {
            ...user,
            stats: {
              totalOrders: user._count.orders,
              deliveredOrders: user._count.deliveredOrders,
              activeOrders
            }
          };
        }
        
        return {
          ...user,
          stats: {
            totalOrders: user._count.orders
          }
        };
      })
    );
    
    ApiResponseUtil.paginated(res, usersWithStats, { 
      page: page || 1, 
      limit: limit || 20, 
      total 
    });
  } catch (error) {
    next(error);
  }
};

// Изменить роль пользователя (только для администраторов)
export const changeUserRole = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const { role } = req.body;
    const userId = parseInt(id);
    
    if (isNaN(userId)) {
      throw new AppError('Неверный ID пользователя', 400);
    }
    
    // Валидация роли
    const allowedRoles = ['CUSTOMER', 'COURIER', 'ADMIN', 'SELLER'];
    if (!allowedRoles.includes(role)) {
      throw new AppError(`Роль должна быть одной из: ${allowedRoles.join(', ')}`, 400);
    }
    
    // Проверяем существование пользователя
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, role: true, name: true, telegram_user_id: true }
    });
    
    if (!user) {
      throw new AppError('Пользователь не найден', 404);
    }
    
    // Проверяем, что роль действительно изменяется
    if (user.role === role) {
      throw new AppError(`Пользователь уже имеет роль ${role}`, 400);
    }
    
    const oldRole = user.role;
    
    // Обновляем роль пользователя
    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: { role },
      select: { id: true, role: true, name: true, telegram_user_id: true }
    });
    
    // Инвалидируем кэш пользователей
    // (здесь можно добавить инвалидацию кэша, если используется)
    
    console.log(`👤 Роль пользователя ${userId} изменена с ${oldRole} на ${role} администратором ${req.user!.id}`);
    
    ApiResponseUtil.success(res, {
      userId: updatedUser.id,
      oldRole,
      newRole: updatedUser.role,
      updatedAt: new Date().toISOString(),
      user: {
        id: updatedUser.id,
        name: updatedUser.name,
        telegram_user_id: updatedUser.telegram_user_id
      }
    }, 'Роль пользователя успешно изменена');
  } catch (error) {
    next(error);
  }
};

// PATCH /api/user/me — обновить имя и номер телефона
export const updateMe = async (req: AuthRequest, res: Response) => {
  if (!req.user) return res.status(401).json({ message: 'Не авторизован' });
  const { name, phone_number } = req.body;
  if (!name && !phone_number) return res.status(400).json({ message: 'Нужно передать name или phone_number' });
  const updated = await prisma.user.update({
    where: { id: req.user.id },
    data: {
      ...(name !== undefined ? { name } : {}),
      ...(phone_number !== undefined ? { phone_number } : {})
    }
  });
  res.json({ id: updated.id, telegram_user_id: updated.telegram_user_id, role: updated.role, phone_number: updated.phone_number, name: updated.name });
};

export const getMe = (req: AuthRequest, res: Response) => {
  if (!req.user) return res.status(401).json({ message: 'Не авторизован' });
  const { id, telegram_user_id, role, phone_number, name } = req.user as any;
  res.json({ id, telegram_user_id, role, phone_number, name });
};
