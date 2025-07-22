import prisma from '../lib/prisma';
import { AppError } from '../middlewares/errorHandler';
import { 
  CreateProductRequest, 
  UpdateProductRequest, 
  ProductFilter, 
  PaginationOptions,
  PaginatedResponse 
} from '../types';
import { PaginationUtil, FilterUtil } from '../utils/apiResponse';

export class ProductService {
  async createProduct(data: CreateProductRequest) {
    // Проверяем существование магазина
    const store = await prisma.store.findUnique({
      where: { id: data.storeId }
    });

    if (!store) {
      throw new AppError('Магазин не найден', 404);
    }

    // Проверяем существование категории, если указана
    if (data.categoryId) {
      const category = await prisma.category.findUnique({
        where: { id: data.categoryId }
      });

      if (!category) {
        throw new AppError('Категория не найдена', 404);
      }
    }

    return prisma.product.create({
      data: {
        name: data.name.trim(),
        price: data.price,
        storeId: data.storeId,
        image: data.image?.trim() || null,
        categoryId: data.categoryId || null
      },
      include: {
        store: {
          select: { id: true, name: true, address: true }
        },
        category: {
          select: { id: true, name: true }
        }
      }
    });
  }

  async getProducts(
    filters: ProductFilter = {}, 
    pagination: PaginationOptions
  ): Promise<PaginatedResponse<any>> {
    const { skip, take } = PaginationUtil.getSkipTake(pagination.page, pagination.limit);
    
    // Строим фильтры
    const whereClause: any = {};
    
    if (filters.search) {
      whereClause.name = FilterUtil.buildStringFilter(filters.search);
    }
    
    if (filters.storeId) {
      whereClause.storeId = filters.storeId;
    }
    
    if (filters.categoryId) {
      whereClause.categoryId = filters.categoryId;
    }
    
    if (filters.minPrice !== undefined || filters.maxPrice !== undefined) {
      whereClause.price = {};
      if (filters.minPrice !== undefined) {
        whereClause.price.gte = filters.minPrice;
      }
      if (filters.maxPrice !== undefined) {
        whereClause.price.lte = filters.maxPrice;
      }
    }

    // Строим сортировку
    const orderBy = PaginationUtil.buildOrderBy(pagination.sortBy, pagination.sortOrder);

    const [products, total] = await Promise.all([
      prisma.product.findMany({
        where: whereClause,
        include: {
          store: {
            select: { id: true, name: true, address: true }
          },
          category: {
            select: { id: true, name: true }
          }
        },
        orderBy,
        skip,
        take
      }),
      prisma.product.count({ where: whereClause })
    ]);

    return {
      data: products,
      meta: {
        page: pagination.page,
        limit: pagination.limit,
        total,
        totalPages: Math.ceil(total / pagination.limit)
      }
    };
  }

  async getProductById(id: number) {
    const product = await prisma.product.findUnique({
      where: { id },
      include: {
        store: {
          select: { id: true, name: true, address: true }
        },
        category: {
          select: { id: true, name: true }
        }
      }
    });

    if (!product) {
      throw new AppError('Товар не найден', 404);
    }

    return product;
  }

  async updateProduct(id: number, data: UpdateProductRequest) {
    const existingProduct = await prisma.product.findUnique({
      where: { id }
    });

    if (!existingProduct) {
      throw new AppError('Товар не найден', 404);
    }

    // Проверяем существование магазина, если он изменяется
    if (data.storeId && data.storeId !== existingProduct.storeId) {
      const store = await prisma.store.findUnique({
        where: { id: data.storeId }
      });

      if (!store) {
        throw new AppError('Магазин не найден', 404);
      }
    }

    // Проверяем существование категории, если она изменяется
    if (data.categoryId && data.categoryId !== existingProduct.categoryId) {
      const category = await prisma.category.findUnique({
        where: { id: data.categoryId }
      });

      if (!category) {
        throw new AppError('Категория не найдена', 404);
      }
    }

    const updateData: any = {};
    if (data.name !== undefined) updateData.name = data.name.trim();
    if (data.price !== undefined) updateData.price = data.price;
    if (data.storeId !== undefined) updateData.storeId = data.storeId;
    if (data.image !== undefined) updateData.image = data.image ? data.image.trim() : null;
    if (data.categoryId !== undefined) updateData.categoryId = data.categoryId || null;

    return prisma.product.update({
      where: { id },
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
  }

  async deleteProduct(id: number) {
    const existingProduct = await prisma.product.findUnique({
      where: { id }
    });

    if (!existingProduct) {
      throw new AppError('Товар не найден', 404);
    }

    // Проверяем, нет ли связанных заказов
    const orderItems = await prisma.orderItem.findFirst({
      where: { productId: id }
    });

    if (orderItems) {
      throw new AppError('Нельзя удалить товар, который есть в заказах', 400);
    }

    await prisma.product.delete({
      where: { id }
    });
  }

  async getProductStock(productId: number) {
    const movements = await prisma.stockMovement.findMany({
      where: { productId },
      select: { quantity: true, type: true }
    });

    const stock = movements.reduce((sum, movement) => {
      return movement.type === 'INCOME' 
        ? sum + movement.quantity 
        : sum - movement.quantity;
    }, 0);

    return { productId, stock };
  }
}
