import { Request, Response, NextFunction } from 'express';
import { OrderService } from '../services/orderService';
import { ApiResponseUtil } from '../utils/apiResponse';
import { AuthRequest } from '../middlewares/auth';
import { cacheService, CacheService } from '../utils/cache';
import { 
  createOrderSchema, 
  orderFilterSchema,
  paginationSchema,
  idSchema,
  updateOrderStatusSchema
} from '../validators/schemas';
import { validateBody, validateParams, validateQuery } from '../middlewares/zodValidation';

const orderService = new OrderService();

export const createOrder = [
  validateBody(createOrderSchema),
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const userId = req.user!.id;
      
      const order = await orderService.createOrder(userId, req.body);
      
      // Инвалидируем кэш заказов
      cacheService.invalidatePattern(`orders:*`);
      cacheService.invalidatePattern(`user:${userId}:orders:*`);
      
      ApiResponseUtil.created(res, order, 'Заказ успешно создан');
    } catch (error) {
      next(error);
    }
  }
];

export const getOrders = [
  validateQuery(paginationSchema.merge(orderFilterSchema)),
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const { page, limit, sortBy, sortOrder, ...filters } = (req as any).validatedQuery;
      const pagination = { page, limit, sortBy, sortOrder };
      const userId = req.user!.id;
      const isAdmin = req.user!.role === 'ADMIN';
      
      // Генерируем ключ кэша
      const cachePrefix = isAdmin ? 'orders' : `user:${userId}:orders`;
      const cacheKey = CacheService.generatePaginationKey(
        cachePrefix,
        page,
        limit,
        { ...filters, sortBy, sortOrder }
      );
      
      // Проверяем кэш (короткое время для заказов)
      const result = await cacheService.memoize(
        cacheKey,
        () => orderService.getOrders(pagination, userId, filters, isAdmin),
        2 * 60 * 1000 // 2 минуты
      );
      
      ApiResponseUtil.paginated(res, result.data, result.meta);
    } catch (error) {
      next(error);
    }
  }
];

export const getAllOrders = [
  validateQuery(paginationSchema.merge(orderFilterSchema)),
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const { page, limit, sortBy, sortOrder, ...filters } = (req as any).validatedQuery;
      const pagination = { page, limit, sortBy, sortOrder };
      
      // Генерируем ключ кэша для админа
      const cacheKey = CacheService.generatePaginationKey(
        'admin:orders',
        page,
        limit,
        { ...filters, sortBy, sortOrder }
      );
      
      const result = await cacheService.memoize(
        cacheKey,
        () => orderService.getOrders(pagination, undefined, filters, true),
        2 * 60 * 1000 // 2 минуты
      );
      
      ApiResponseUtil.paginated(res, result.data, result.meta);
    } catch (error) {
      next(error);
    }
  }
];

export const getOrder = [
  validateParams(idSchema),
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const { id } = (req as any).validatedParams;
      const userId = req.user!.id;
      const isAdmin = req.user!.role === 'ADMIN';
      
      const cacheKey = isAdmin 
        ? CacheService.generateResourceKey('admin:order', id)
        : CacheService.generateResourceKey(`user:${userId}:order`, id);
      
      const order = await cacheService.memoize(
        cacheKey,
        () => orderService.getOrderById(id, userId, isAdmin),
        5 * 60 * 1000 // 5 минут
      );
      
      ApiResponseUtil.success(res, order);
    } catch (error) {
      next(error);
    }
  }
];

export const updateOrderStatus = [
  validateParams(idSchema),
  validateBody(updateOrderStatusSchema),
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const { id } = (req as any).validatedParams;
      const { status } = req.body;
      
      const orderStatus = await orderService.updateOrderStatus(id, status);
      
      // Инвалидируем кэш заказов
      cacheService.invalidatePattern(`*order:${id}*`);
      cacheService.invalidatePattern('orders:*');
      cacheService.invalidatePattern('admin:orders:*');
      
      ApiResponseUtil.success(res, orderStatus, 'Статус заказа обновлен');
    } catch (error) {
      next(error);
    }
  }
];

export const getOrderStatuses = [
  validateParams(idSchema),
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const { id } = (req as any).validatedParams;
      
      const cacheKey = `order:${id}:statuses`;
      
      const statuses = await cacheService.memoize(
        cacheKey,
        () => orderService.getOrderStatuses(id),
        5 * 60 * 1000 // 5 минут
      );
      
      ApiResponseUtil.success(res, statuses);
    } catch (error) {
      next(error);
    }
  }
];
