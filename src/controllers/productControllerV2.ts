import { Request, Response, NextFunction } from 'express';
import { ProductService } from '../services/productService';
import { ApiResponseUtil } from '../utils/apiResponse';
import { AuthRequest } from '../middlewares/auth';
import { cacheService, CacheService } from '../utils/cache';
import { 
  createProductSchema, 
  updateProductSchema, 
  productFilterSchema,
  paginationSchema,
  idSchema
} from '../validators/schemas';
import { validateBody, validateParams, validateQuery } from '../middlewares/zodValidation';

const productService = new ProductService();

export const createProduct = [
  validateBody(createProductSchema),
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const product = await productService.createProduct(req.body);
      
      // Инвалидируем кэш продуктов
      cacheService.invalidatePattern('products:*');
      
      ApiResponseUtil.created(res, product, 'Товар успешно создан');
    } catch (error) {
      next(error);
    }
  }
];

export const getProducts = [
  validateQuery(paginationSchema.merge(productFilterSchema)),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { page, limit, sortBy, sortOrder, ...filters } = (req as any).validatedQuery;
      
      const pagination = { page, limit, sortBy, sortOrder };
      
      // Генерируем ключ кэша
      const cacheKey = CacheService.generatePaginationKey(
        'products',
        page,
        limit,
        { ...filters, sortBy, sortOrder }
      );
      
      // Проверяем кэш
      const result = await cacheService.memoize(
        cacheKey,
        () => productService.getProducts(filters, pagination),
        5 * 60 * 1000 // 5 минут
      );
      
      ApiResponseUtil.paginated(res, result.data, result.meta);
    } catch (error) {
      next(error);
    }
  }
];

export const getProduct = [
  validateParams(idSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = (req as any).validatedParams;
      
      const cacheKey = CacheService.generateResourceKey('product', id);
      
      const product = await cacheService.memoize(
        cacheKey,
        () => productService.getProductById(id),
        10 * 60 * 1000 // 10 минут
      );
      
      ApiResponseUtil.success(res, product);
    } catch (error) {
      next(error);
    }
  }
];

export const updateProduct = [
  validateParams(idSchema),
  validateBody(updateProductSchema),
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const { id } = (req as any).validatedParams;
      
      const product = await productService.updateProduct(id, req.body);
      
      // Инвалидируем кэш
      cacheService.delete(CacheService.generateResourceKey('product', id));
      cacheService.invalidatePattern('products:*');
      
      ApiResponseUtil.success(res, product, 'Товар успешно обновлен');
    } catch (error) {
      next(error);
    }
  }
];

export const deleteProduct = [
  validateParams(idSchema),
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const { id } = (req as any).validatedParams;
      
      await productService.deleteProduct(id);
      
      // Инвалидируем кэш
      cacheService.delete(CacheService.generateResourceKey('product', id));
      cacheService.invalidatePattern('products:*');
      
      ApiResponseUtil.success(res, { deleted: true }, 'Товар успешно удален');
    } catch (error) {
      next(error);
    }
  }
];

export const getProductStock = [
  validateParams(idSchema),
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const { id } = (req as any).validatedParams;
      
      const cacheKey = `stock:${id}`;
      
      const stock = await cacheService.memoize(
        cacheKey,
        () => productService.getProductStock(id),
        2 * 60 * 1000 // 2 минуты для склада
      );
      
      ApiResponseUtil.success(res, stock);
    } catch (error) {
      next(error);
    }
  }
];
