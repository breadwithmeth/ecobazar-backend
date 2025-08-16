import { Request, Response, NextFunction } from 'express';
import prisma from '../lib/prisma';
import { AppError } from '../middlewares/errorHandler';
import { ApiResponseUtil, PaginationUtil, FilterUtil } from '../utils/apiResponse';
import { AuthRequest } from '../middlewares/auth';

export const createProduct = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { name, price, storeId, image, categoryId, unit, isVisible } = req.body;
    
    // Проверяем существование магазина
    const store = await prisma.store.findUnique({
      where: { id: storeId }
    });
    
    if (!store) {
      throw new AppError('Магазин не найден', 404);
    }
    
    // Проверяем существование категории, если указана
    if (categoryId) {
      const category = await prisma.category.findUnique({
        where: { id: categoryId }
      });
      
      if (!category) {
        throw new AppError('Категория не найдена', 404);
      }
    }
    
    const data: any = { 
      name: name.trim(), 
      price: parseFloat(price), 
      storeId: parseInt(storeId)
    };
    
    if (image) data.image = image.trim();
    if (categoryId) data.categoryId = parseInt(categoryId);
    if (unit) data.unit = unit.trim();
    if (typeof isVisible === 'boolean') data.isVisible = isVisible;
    
    const product = await prisma.product.create({ 
      data,
      include: {
        store: {
          select: { id: true, name: true, address: true }
        },
        category: {
          select: { id: true, name: true }
        }
      }
    });
    
    ApiResponseUtil.created(res, product, 'Товар успешно создан');
  } catch (error) {
    next(error);
  }
};

export const getProducts = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { page, limit, sortBy, sortOrder } = PaginationUtil.parseQuery(req.query);
    const { skip, take } = PaginationUtil.getSkipTake(page, limit);
    
    // Фильтрация
    const filters: any = {};
    
    // Показываем только видимые товары по умолчанию
    if (req.query.isVisible === undefined) {
      filters.isVisible = true;
    } else {
      const v = String(req.query.isVisible).toLowerCase();
      if (v === 'true') filters.isVisible = true;
      else if (v === 'false') filters.isVisible = false;
    }
    
    // Фильтр по категории
    const categoryId = FilterUtil.buildNumberFilter(req.query.categoryId as string);
    if (categoryId) filters.categoryId = categoryId;
    
    // Фильтр по магазину
    const storeId = FilterUtil.buildNumberFilter(req.query.storeId as string);
    if (storeId) filters.storeId = storeId;
    
    // Поиск по названию
    const search = FilterUtil.buildStringFilter(req.query.search as string);
    if (search) filters.name = search;
    
    // Фильтр по цене
    const minPrice = FilterUtil.buildNumberFilter(req.query.minPrice as string);
    const maxPrice = FilterUtil.buildNumberFilter(req.query.maxPrice as string);
    if (minPrice || maxPrice) {
      filters.price = {};
      if (minPrice) filters.price.gte = minPrice;
      if (maxPrice) filters.price.lte = maxPrice;
    }
    
    const orderBy = { id: 'desc' } as any;

    // Получаем общее количество товаров
    const total = await prisma.product.count({ where: filters });
    
    // Получаем товары с пагинацией
    const products = await prisma.product.findMany({
      where: filters,
      skip,
      take,
      orderBy,
      include: {
        store: {
          select: { id: true, name: true, address: true }
        },
        category: {
          select: { id: true, name: true }
        }
      }
    });
    
    // Получаем остатки для всех товаров одним запросом
    const productIds = products.map(p => p.id);
    const movements = await prisma.stockMovement.findMany({
      where: { productId: { in: productIds } },
      select: { productId: true, type: true, quantity: true }
    });
    
    // Группируем и считаем остатки
    const stockMap = new Map<number, number>();
    for (const movement of movements) {
      const current = stockMap.get(movement.productId) || 0;
      const change = movement.type === 'INCOME' ? movement.quantity : -movement.quantity;
      stockMap.set(movement.productId, current + change);
    }
    
    // Добавляем информацию об остатках к товарам
    const productsWithStock = products.map(product => ({
      ...product,
      stock: stockMap.get(product.id) || 0,
      inStock: (stockMap.get(product.id) || 0) > 0
    }));
    
    ApiResponseUtil.paginated(res, productsWithStock, { 
      page: page || 1, 
      limit: limit || 10, 
      total 
    });
  } catch (error) {
    next(error);
  }
};

// Новый эндпоинт для получения всех товаров сразу без пагинации
export const getAllProducts = async (req: Request, res: Response, next: NextFunction) => {
  try {
    // Фильтрация (те же фильтры что и в getProducts, но без пагинации)
    const filters: any = {};

    // Показываем только видимые товары по умолчанию
    if (req.query.isVisible === undefined) {
      filters.isVisible = true;
    } else {
      const v = String(req.query.isVisible).toLowerCase();
      if (v === 'true') filters.isVisible = true;
      else if (v === 'false') filters.isVisible = false;
    }

    // Фильтр по категории
    const categoryId = FilterUtil.buildNumberFilter(req.query.categoryId as string);
    if (categoryId) filters.categoryId = categoryId;
    
    // Фильтр по магазину
    const storeId = FilterUtil.buildNumberFilter(req.query.storeId as string);
    if (storeId) filters.storeId = storeId;
    
    // Поиск по названию
    const search = FilterUtil.buildStringFilter(req.query.search as string);
    if (search) filters.name = search;
    
    // Фильтр по цене
    const minPrice = FilterUtil.buildNumberFilter(req.query.minPrice as string);
    const maxPrice = FilterUtil.buildNumberFilter(req.query.maxPrice as string);
    if (minPrice || maxPrice) {
      filters.price = {};
      if (minPrice) filters.price.gte = minPrice;
      if (maxPrice) filters.price.lte = maxPrice;
    }
    
    // Сортировка (по умолчанию по ID)
    const sortBy = req.query.sortBy as string || 'id';
    const sortOrder = req.query.sortOrder === 'desc' ? 'desc' : 'asc';
    const orderBy = PaginationUtil.buildOrderBy(sortBy, sortOrder);

    // Получаем ВСЕ товары без пагинации
    const products = await prisma.product.findMany({
      where: filters,
      orderBy,
      include: {
        store: {
          select: { id: true, name: true, address: true }
        },
        category: {
          select: { id: true, name: true }
        }
      }
    });
    
    // Получаем остатки для всех товаров одним запросом
    const productIds = products.map(p => p.id);
    const movements = await prisma.stockMovement.findMany({
      where: { productId: { in: productIds } },
      select: { productId: true, type: true, quantity: true }
    });
    
    // Группируем и считаем остатки
    const stockMap = new Map<number, number>();
    for (const movement of movements) {
      const current = stockMap.get(movement.productId) || 0;
      const change = movement.type === 'INCOME' ? movement.quantity : -movement.quantity;
      stockMap.set(movement.productId, current + change);
    }
    
    // Добавляем информацию об остатках к товарам
    const productsWithStock = products.map(product => ({
      ...product,
      stock: stockMap.get(product.id) || 0,
      inStock: (stockMap.get(product.id) || 0) > 0
    }));
    
    ApiResponseUtil.success(res, {
      products: productsWithStock,
      total: productsWithStock.length
    });
  } catch (error) {
    next(error);
  }
};

export const getProduct = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const productId = parseInt(id);
    
    if (isNaN(productId)) {
      throw new AppError('Неверный ID товара', 400);
    }
    
    const product = await prisma.product.findUnique({
      where: { id: productId },
      include: {
        store: {
          select: { id: true, name: true, address: true }
        },
        category: {
          select: { id: true, name: true }
        }
      }
    });
    
    if (!product || product.isVisible === false) {
      throw new AppError('Товар не найден', 404);
    }
    
    // Получаем остаток товара
    const movements = await prisma.stockMovement.findMany({
      where: { productId },
      select: { type: true, quantity: true }
    });
    
    const stock = movements.reduce((total, movement) => {
      return total + (movement.type === 'INCOME' ? movement.quantity : -movement.quantity);
    }, 0);
    
    const productWithStock = {
      ...product,
      stock,
      inStock: stock > 0
    };
    
    ApiResponseUtil.success(res, productWithStock);
  } catch (error) {
    next(error);
  }
};

export const updateProduct = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const productId = parseInt(id);
    
    if (isNaN(productId)) {
      throw new AppError('Неверный ID товара', 400);
    }
    
    const { name, price, storeId, image, categoryId, unit, isVisible } = req.body;
    
    // Проверяем существование товара
    const existingProduct = await prisma.product.findUnique({
      where: { id: productId }
    });
    
    if (!existingProduct) {
      throw new AppError('Товар не найден', 404);
    }
    
    // Проверяем существование магазина, если он изменяется
    if (storeId && storeId !== existingProduct.storeId) {
      const store = await prisma.store.findUnique({
        where: { id: parseInt(storeId) }
      });
      
      if (!store) {
        throw new AppError('Магазин не найден', 404);
      }
    }
    
    // Проверяем существование категории, если она изменяется
    if (categoryId && categoryId !== existingProduct.categoryId) {
      const category = await prisma.category.findUnique({
        where: { id: parseInt(categoryId) }
      });
      
      if (!category) {
        throw new AppError('Категория не найдена', 404);
      }
    }
    
    const updateData: any = {};
    if (name !== undefined) updateData.name = name.trim();
    if (price !== undefined) updateData.price = parseFloat(price);
    if (storeId !== undefined) updateData.storeId = parseInt(storeId);
    if (image !== undefined) updateData.image = image ? image.trim() : null;
    if (categoryId !== undefined) updateData.categoryId = categoryId ? parseInt(categoryId) : null;
    if (unit !== undefined) updateData.unit = unit ? unit.trim() : null;
    if (isVisible !== undefined) updateData.isVisible = !!isVisible;
    
    const updatedProduct = await prisma.product.update({
      where: { id: productId },
      data: updateData,
      include: {
        store: {
          select: { id: true, name: true, address: true }
        },
        category: {
          select: { id: true, name: true }
        }
      }
    });
    
    ApiResponseUtil.success(res, updatedProduct, 'Товар успешно обновлен');
  } catch (error) {
    next(error);
  }
};

export const deleteProduct = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const productId = parseInt(id);
    
    if (isNaN(productId)) {
      throw new AppError('Неверный ID товара', 400);
    }
    
    // Проверяем существование товара
    const product = await prisma.product.findUnique({
      where: { id: productId }
    });
    
    if (!product) {
      throw new AppError('Товар не найден', 404);
    }
    
    // Проверяем, нет ли активных заказов с этим товаром
    const activeOrders = await prisma.orderItem.findFirst({
      where: {
        productId,
        order: {
          statuses: {
            some: {
              status: { not: 'DELIVERED' }
            }
          }
        }
      }
    });
    
    if (activeOrders) {
      throw new AppError('Нельзя удалить товар, который есть в активных заказах', 400);
    }
    
    // Удаляем товар (каскадно удалятся связанные записи)
    await prisma.product.delete({
      where: { id: productId }
    });
    
    ApiResponseUtil.success(res, null, 'Товар успешно удален');
  } catch (error) {
    next(error);
  }
};
