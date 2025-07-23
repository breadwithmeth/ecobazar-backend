import { Request, Response, NextFunction } from 'express';
import { AuthRequest } from '../middlewares/auth';
import { ApiResponseUtil } from '../utils/apiResponse';
import { AppError } from '../middlewares/errorHandler';
import { PaginationUtil } from '../utils/pagination';
import { StoreService } from '../services/storeService';
import { validateParams, validateBody, validateQuery } from '../middlewares/zodValidation';
import { z } from 'zod';
import { 
  idSchema,
  createStoreSchema,
  updateStoreSchema,
  paginationSchema,
  storeFilterSchema,
  assignStoreOwnerSchema,
  storeConfirmationSchema
} from '../validators/schemas';

const storeService = new StoreService();

// Получить все магазины (публичный доступ)
export const getStores = [
  validateQuery(paginationSchema.merge(storeFilterSchema)),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { page, limit, sortBy, sortOrder, ...filters } = (req as any).validatedQuery;
      const pagination = { page, limit, sortBy, sortOrder };
      
      const result = await storeService.getStores(pagination, filters);
      
      ApiResponseUtil.paginated(res, result.data, result.meta);
    } catch (error) {
      next(error);
    }
  }
];

// Получить магазин по ID (публичный доступ)
export const getStore = [
  validateParams(idSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = (req as any).validatedParams;
      
      const store = await storeService.getStoreById(id);
      
      ApiResponseUtil.success(res, store);
    } catch (error) {
      next(error);
    }
  }
];

// Получить мой магазин (для SELLER)
export const getMyStore = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    if (req.user!.role !== 'SELLER') {
      throw new AppError('Доступ только для продавцов', 403);
    }
    
    const store = await storeService.getStoreByOwner(req.user!.id);
    
    if (!store) {
      throw new AppError('У вас нет назначенного магазина', 404);
    }
    
    ApiResponseUtil.success(res, store);
  } catch (error) {
    next(error);
  }
};

// Создать магазин (только для ADMIN)
export const createStore = [
  validateBody(createStoreSchema),
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const storeData = (req as any).validatedBody;
      
      const store = await storeService.createStore(storeData);
      
      ApiResponseUtil.success(res, store, 'Магазин успешно создан', 201);
    } catch (error) {
      next(error);
    }
  }
];

// Обновить магазин (ADMIN или владелец магазина)
export const updateStore = [
  validateParams(idSchema),
  validateBody(updateStoreSchema),
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const { id } = (req as any).validatedParams;
      const updateData = (req as any).validatedBody;
      const userId = req.user!.id;
      const isAdmin = req.user!.role === 'ADMIN';
      
      const store = await storeService.updateStore(id, updateData, userId, isAdmin);
      
      ApiResponseUtil.success(res, store, 'Магазин успешно обновлен');
    } catch (error) {
      next(error);
    }
  }
];

// Назначить владельца магазина (только для ADMIN)
export const assignStoreOwner = [
  validateParams(idSchema),
  validateBody(assignStoreOwnerSchema),
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const { id } = (req as any).validatedParams;
      const { ownerId } = (req as any).validatedBody;
      
      const store = await storeService.assignOwner(id, ownerId);
      
      ApiResponseUtil.success(res, store, 'Владелец магазина назначен');
    } catch (error) {
      next(error);
    }
  }
];

// Удалить магазин (только для ADMIN)
export const deleteStore = [
  validateParams(idSchema),
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const { id } = (req as any).validatedParams;
      
      await storeService.deleteStore(id);
      
      ApiResponseUtil.success(res, null, 'Магазин удален');
    } catch (error) {
      next(error);
    }
  }
];

// Получить заказы для моего магазина (для SELLER)
export const getStoreOrders = [
  validateQuery(paginationSchema),
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      if (req.user!.role !== 'SELLER') {
        throw new AppError('Доступ только для продавцов', 403);
      }
      
      const { page, limit, sortBy, sortOrder } = (req as any).validatedQuery;
      const pagination = { page, limit, sortBy, sortOrder };
      
      const store = await storeService.getStoreByOwner(req.user!.id);
      if (!store) {
        throw new AppError('У вас нет назначенного магазина', 404);
      }
      
      const result = await storeService.getStoreOrders(store.id, pagination);
      
      ApiResponseUtil.paginated(res, result.data, result.meta);
    } catch (error) {
      next(error);
    }
  }
];

// Получить элементы заказов для подтверждения (для SELLER)
export const getStoreOrderItems = [
  validateQuery(paginationSchema.extend({
    status: z.enum(['PENDING', 'CONFIRMED', 'PARTIAL', 'REJECTED']).optional(),
    orderId: z.string().transform(Number).optional()
  })),
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      if (req.user!.role !== 'SELLER') {
        throw new AppError('Доступ только для продавцов', 403);
      }
      
      const { page, limit, sortBy, sortOrder, status, orderId } = (req as any).validatedQuery;
      const pagination = { page, limit, sortBy, sortOrder };
      
      const store = await storeService.getStoreByOwner(req.user!.id);
      if (!store) {
        throw new AppError('У вас нет назначенного магазина', 404);
      }
      
      const result = await storeService.getStoreOrderItems(
        store.id, 
        pagination, 
        { status, orderId }
      );
      
      ApiResponseUtil.paginated(res, result.data, result.meta);
    } catch (error) {
      next(error);
    }
  }
];

// Подтвердить элемент заказа (для SELLER)
export const confirmOrderItem = [
  validateParams(z.object({
    orderItemId: z.string().transform(Number)
  })),
  validateBody(storeConfirmationSchema),
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      if (req.user!.role !== 'SELLER') {
        throw new AppError('Доступ только для продавцов', 403);
      }
      
      const { orderItemId } = (req as any).validatedParams;
      const confirmationData = (req as any).validatedBody;
      
      const store = await storeService.getStoreByOwner(req.user!.id);
      if (!store) {
        throw new AppError('У вас нет назначенного магазина', 404);
      }
      
      const confirmation = await storeService.confirmOrderItem(
        orderItemId,
        store.id,
        req.user!.id,
        confirmationData
      );
      
      ApiResponseUtil.success(res, confirmation, 'Подтверждение товара обновлено');
    } catch (error) {
      next(error);
    }
  }
];

// Получить статистику подтверждений (для SELLER)
export const getStoreStats = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    if (req.user!.role !== 'SELLER') {
      throw new AppError('Доступ только для продавцов', 403);
    }
    
    const store = await storeService.getStoreByOwner(req.user!.id);
    if (!store) {
      throw new AppError('У вас нет назначенного магазина', 404);
    }
    
    const stats = await storeService.getStoreConfirmationStats(store.id);
    
    ApiResponseUtil.success(res, stats);
  } catch (error) {
    next(error);
  }
};
