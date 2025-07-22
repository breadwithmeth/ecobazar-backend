// Setup для тестов
import { jest } from '@jest/globals';

// Мокаем переменные окружения для тестов
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test-secret-key-12345';
process.env.DATABASE_URL = 'postgresql://test:test@localhost:5432/test_db';

// Отключаем логирование в тестах
jest.mock('../src/utils/logger', () => ({
  logger: {
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn(),
    logRequest: jest.fn(),
    logError: jest.fn(),
    logSecurityEvent: jest.fn(),
    logDatabase: jest.fn()
  },
  requestLoggerMiddleware: (req: any, res: any, next: any) => next()
}));

// Мокаем базу данных для тестов
jest.mock('../src/lib/prisma', () => ({
  __esModule: true,
  default: {
    $transaction: jest.fn(),
    user: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      count: jest.fn()
    },
    product: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      count: jest.fn()
    },
    order: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      count: jest.fn()
    },
    orderItem: {
      findFirst: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn()
    },
    orderStatus: {
      findMany: jest.fn(),
      create: jest.fn()
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
    stockMovement: {
      findMany: jest.fn(),
      create: jest.fn()
    },
    userAddress: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
      create: jest.fn(),
      delete: jest.fn()
    }
  }
}));

// Очищаем все моки после каждого теста
afterEach(() => {
  jest.clearAllMocks();
});

// Глобальные утилиты для тестов
declare global {
  var mockUser: any;
  var mockAdmin: any;
}

global.mockUser = {
  id: 1,
  telegram_user_id: '123456789',
  role: 'CUSTOMER',
  name: 'Test User',
  phone_number: '+1234567890'
};

global.mockAdmin = {
  id: 2,
  telegram_user_id: '987654321',
  role: 'ADMIN',
  name: 'Admin User',
  phone_number: '+0987654321'
};
