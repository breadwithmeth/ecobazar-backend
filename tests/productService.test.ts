import { ProductService } from '../src/services/productService';
import { AppError } from '../src/middlewares/errorHandler';

// Мокаем модуль prisma
jest.mock('../src/lib/prisma', () => ({
  __esModule: true,
  default: {
    product: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      count: jest.fn()
    },
    store: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn()
    },
    category: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn()
    },
    orderItem: {
      findFirst: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn()
    },
    stockMovement: {
      findMany: jest.fn(),
      create: jest.fn()
    }
  }
}));

// Импортируем замоканный prisma
import prisma from '../src/lib/prisma';

// Получаем типизированные моки
const mockPrisma = prisma as any;

describe('ProductService', () => {
  let productService: ProductService;

  beforeEach(() => {
    productService = new ProductService();
  });

  describe('createProduct', () => {
    const mockProductData = {
      name: 'Test Product',
      price: 99.99,
      storeId: 1,
      image: 'test-image.jpg',
      categoryId: 1
    };

    const mockStore = {
      id: 1,
      name: 'Test Store',
      address: 'Test Address'
    };

    const mockCategory = {
      id: 1,
      name: 'Test Category'
    };

    const mockCreatedProduct = {
      id: 1,
      ...mockProductData,
      store: mockStore,
      category: mockCategory
    };

    it('должен создать продукт успешно', async () => {
      mockPrisma.store.findUnique.mockResolvedValue(mockStore);
      mockPrisma.category.findUnique.mockResolvedValue(mockCategory);
      mockPrisma.product.create.mockResolvedValue(mockCreatedProduct);

      const result = await productService.createProduct(mockProductData);

      expect(result).toEqual(mockCreatedProduct);
      expect(mockPrisma.store.findUnique).toHaveBeenCalledWith({
        where: { id: mockProductData.storeId }
      });
      expect(mockPrisma.category.findUnique).toHaveBeenCalledWith({
        where: { id: mockProductData.categoryId }
      });
      expect(mockPrisma.product.create).toHaveBeenCalledWith({
        data: {
          name: mockProductData.name.trim(),
          price: mockProductData.price,
          storeId: mockProductData.storeId,
          image: mockProductData.image.trim(),
          categoryId: mockProductData.categoryId
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
    });

    it('должен выбросить ошибку если магазин не найден', async () => {
      mockPrisma.store.findUnique.mockResolvedValue(null);

      await expect(productService.createProduct(mockProductData)).rejects.toThrow(
        new AppError('Магазин не найден', 404)
      );

      expect(mockPrisma.store.findUnique).toHaveBeenCalledWith({
        where: { id: mockProductData.storeId }
      });
      expect(mockPrisma.product.create).not.toHaveBeenCalled();
    });

    it('должен выбросить ошибку если категория не найдена', async () => {
      mockPrisma.store.findUnique.mockResolvedValue(mockStore);
      mockPrisma.category.findUnique.mockResolvedValue(null);

      await expect(productService.createProduct(mockProductData)).rejects.toThrow(
        new AppError('Категория не найдена', 404)
      );

      expect(mockPrisma.category.findUnique).toHaveBeenCalledWith({
        where: { id: mockProductData.categoryId }
      });
      expect(mockPrisma.product.create).not.toHaveBeenCalled();
    });

    it('должен создать продукт без категории', async () => {
      const dataWithoutCategory = { ...mockProductData, categoryId: undefined };

      const expectedProduct = {
        ...mockCreatedProduct,
        categoryId: null,
        category: null
      };

      mockPrisma.store.findUnique.mockResolvedValue(mockStore);
      mockPrisma.product.create.mockResolvedValue(expectedProduct);

      const result = await productService.createProduct(dataWithoutCategory);

      expect(result).toEqual(expectedProduct);
      expect(mockPrisma.category.findUnique).not.toHaveBeenCalled();
      expect(mockPrisma.product.create).toHaveBeenCalledWith({
        data: {
          name: dataWithoutCategory.name.trim(),
          price: dataWithoutCategory.price,
          storeId: dataWithoutCategory.storeId,
          image: dataWithoutCategory.image.trim(),
          categoryId: null
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
    });
  });

  describe('getProducts', () => {
    const mockProducts = [
      {
        id: 1,
        name: 'Product 1',
        price: 99.99,
        storeId: 1,
        categoryId: 1,
        image: 'image1.jpg',
        store: { id: 1, name: 'Store 1', address: 'Address 1' },
        category: { id: 1, name: 'Category 1' }
      },
      {
        id: 2,
        name: 'Product 2',
        price: 149.99,
        storeId: 2,
        categoryId: 2,
        image: 'image2.jpg',
        store: { id: 2, name: 'Store 2', address: 'Address 2' },
        category: { id: 2, name: 'Category 2' }
      }
    ];

    const mockPagination = {
      page: 1,
      limit: 10,
      sortBy: 'id',
      sortOrder: 'asc' as const
    };

    it('должен вернуть продукты с пагинацией', async () => {
      mockPrisma.product.findMany.mockResolvedValue(mockProducts);
      mockPrisma.product.count.mockResolvedValue(2);

      const result = await productService.getProducts({}, mockPagination);

      expect(result).toEqual({
        data: mockProducts,
        meta: {
          page: 1,
          limit: 10,
          total: 2,
          totalPages: 1
        }
      });

      expect(mockPrisma.product.findMany).toHaveBeenCalledWith({
        where: {},
        include: {
          store: {
            select: { id: true, name: true, address: true }
          },
          category: {
            select: { id: true, name: true }
          }
        },
        orderBy: { id: 'asc' },
        skip: 0,
        take: 10
      });

      expect(mockPrisma.product.count).toHaveBeenCalledWith({
        where: {}
      });
    });

    it('должен применить фильтры поиска', async () => {
      const filters = {
        search: 'test',
        storeId: 1,
        categoryId: 2,
        minPrice: 50,
        maxPrice: 200
      };

      mockPrisma.product.findMany.mockResolvedValue([]);
      mockPrisma.product.count.mockResolvedValue(0);

      await productService.getProducts(filters, mockPagination);

      expect(mockPrisma.product.findMany).toHaveBeenCalledWith({
        where: {
          name: {
            contains: 'test',
            mode: 'insensitive'
          },
          storeId: 1,
          categoryId: 2,
          price: {
            gte: 50,
            lte: 200
          }
        },
        include: {
          store: {
            select: { id: true, name: true, address: true }
          },
          category: {
            select: { id: true, name: true }
          }
        },
        orderBy: { id: 'asc' },
        skip: 0,
        take: 10
      });
    });
  });

  describe('getProductById', () => {
    const mockProduct = {
      id: 1,
      name: 'Test Product',
      price: 99.99,
      storeId: 1,
      categoryId: 1,
      image: 'test.jpg',
      store: { id: 1, name: 'Test Store', address: 'Test Address' },
      category: { id: 1, name: 'Test Category' }
    };

    it('должен вернуть продукт по ID', async () => {
      mockPrisma.product.findUnique.mockResolvedValue(mockProduct);

      const result = await productService.getProductById(1);

      expect(result).toEqual(mockProduct);
      expect(mockPrisma.product.findUnique).toHaveBeenCalledWith({
        where: { id: 1 },
        include: {
          store: {
            select: { id: true, name: true, address: true }
          },
          category: {
            select: { id: true, name: true }
          }
        }
      });
    });

    it('должен выбросить ошибку если продукт не найден', async () => {
      mockPrisma.product.findUnique.mockResolvedValue(null);

      await expect(productService.getProductById(999)).rejects.toThrow(
        new AppError('Товар не найден', 404)
      );
    });
  });

  describe('deleteProduct', () => {
    const mockProduct = {
      id: 1,
      name: 'Test Product',
      price: 99.99,
      storeId: 1,
      categoryId: 1,
      image: 'test.jpg'
    };

    it('должен удалить продукт успешно', async () => {
      mockPrisma.product.findUnique.mockResolvedValue(mockProduct);
      mockPrisma.orderItem.findFirst.mockResolvedValue(null);
      mockPrisma.product.delete.mockResolvedValue(mockProduct);

      await productService.deleteProduct(1);

      expect(mockPrisma.product.findUnique).toHaveBeenCalledWith({
        where: { id: 1 }
      });
      expect(mockPrisma.orderItem.findFirst).toHaveBeenCalledWith({
        where: { productId: 1 }
      });
      expect(mockPrisma.product.delete).toHaveBeenCalledWith({
        where: { id: 1 }
      });
    });

    it('должен выбросить ошибку если продукт не найден', async () => {
      mockPrisma.product.findUnique.mockResolvedValue(null);

      await expect(productService.deleteProduct(999)).rejects.toThrow(
        new AppError('Товар не найден', 404)
      );

      expect(mockPrisma.product.delete).not.toHaveBeenCalled();
    });

    it('должен выбросить ошибку если продукт есть в заказах', async () => {
      mockPrisma.product.findUnique.mockResolvedValue(mockProduct);
      mockPrisma.orderItem.findFirst.mockResolvedValue({
        id: 1,
        orderId: 1,
        productId: 1,
        quantity: 2,
        price: 99.99
      });

      await expect(productService.deleteProduct(1)).rejects.toThrow(
        new AppError('Нельзя удалить товар, который есть в заказах', 400)
      );

      expect(mockPrisma.product.delete).not.toHaveBeenCalled();
    });
  });

  describe('getProductStock', () => {
    it('должен рассчитать остаток товара', async () => {
      const mockMovements = [
        { quantity: 100, type: 'INCOME' },
        { quantity: 50, type: 'INCOME' },
        { quantity: 30, type: 'OUTCOME' },
        { quantity: 20, type: 'OUTCOME' }
      ];

      mockPrisma.stockMovement.findMany.mockResolvedValue(mockMovements);

      const result = await productService.getProductStock(1);

      expect(result).toEqual({
        productId: 1,
        stock: 100 // 100 + 50 - 30 - 20 = 100
      });

      expect(mockPrisma.stockMovement.findMany).toHaveBeenCalledWith({
        where: { productId: 1 },
        select: { quantity: true, type: true }
      });
    });

    it('должен вернуть 0 если нет движений', async () => {
      mockPrisma.stockMovement.findMany.mockResolvedValue([]);

      const result = await productService.getProductStock(1);

      expect(result).toEqual({
        productId: 1,
        stock: 0
      });
    });
  });
});
