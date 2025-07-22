import { z } from 'zod';

// Базовые схемы
export const idSchema = z.object({
  id: z.string().regex(/^\d+$/, 'ID должен быть числом').transform(Number)
});

export const paginationSchema = z.object({
  page: z.string().optional().transform((val: string | undefined) => val ? parseInt(val) || 1 : 1),
  limit: z.string().optional().transform((val: string | undefined) => {
    const num = val ? parseInt(val) : 10;
    return Math.min(Math.max(num, 1), 100); // От 1 до 100
  }),
  sortBy: z.string().optional().default('id'),
  sortOrder: z.enum(['asc', 'desc']).optional().default('asc')
});

// Схемы для продуктов
export const createProductSchema = z.object({
  name: z.string()
    .min(1, 'Название обязательно')
    .max(200, 'Название не должно превышать 200 символов')
    .trim(),
  price: z.number()
    .min(0, 'Цена не может быть отрицательной')
    .max(1000000, 'Цена слишком большая'),
  storeId: z.number()
    .min(1, 'ID магазина должен быть положительным'),
  image: z.string()
    .max(500, 'URL изображения слишком длинный')
    .url('Неверный формат URL')
    .optional(),
  categoryId: z.number()
    .min(1, 'ID категории должен быть положительным')
    .optional()
});

export const updateProductSchema = createProductSchema.partial();

export const productFilterSchema = z.object({
  search: z.string().optional(),
  storeId: z.string().transform(Number).optional(),
  categoryId: z.string().transform(Number).optional(),
  minPrice: z.string().transform(Number).optional(),
  maxPrice: z.string().transform(Number).optional()
});

// Схемы для заказов
export const orderItemSchema = z.object({
  productId: z.number().min(1, 'ID продукта должен быть положительным'),
  quantity: z.number().min(1, 'Количество должно быть больше 0').max(100, 'Слишком большое количество'),
  price: z.number().min(0).optional()
});

export const createOrderSchema = z.object({
  items: z.array(orderItemSchema)
    .min(1, 'Заказ должен содержать хотя бы один товар')
    .max(50, 'Слишком много товаров в заказе'),
  address: z.string()
    .min(5, 'Адрес должен содержать минимум 5 символов')
    .max(500, 'Адрес слишком длинный')
    .trim()
});

export const orderFilterSchema = z.object({
  status: z.string().optional(),
  userId: z.string().transform((str: string) => Number(str)).optional(),
  dateFrom: z.string().transform((str: string) => new Date(str)).optional(),
  dateTo: z.string().transform((str: string) => new Date(str)).optional()
});

// Схемы для пользователей
export const createUserSchema = z.object({
  telegram_user_id: z.string()
    .regex(/^\d+$/, 'telegram_user_id должен содержать только цифры')
    .min(5, 'telegram_user_id должен содержать минимум 5 цифр')
    .max(15, 'telegram_user_id должен содержать максимум 15 цифр')
});

export const updateUserSchema = z.object({
  name: z.string()
    .min(1, 'Имя не может быть пустым')
    .max(100, 'Имя слишком длинное')
    .trim()
    .optional(),
  phone_number: z.string()
    .regex(/^\+?[1-9]\d{1,14}$/, 'Неверный формат номера телефона')
    .optional()
}).refine((data: any) => data.name !== undefined || data.phone_number !== undefined, {
  message: 'Необходимо указать имя или номер телефона'
});

// Схемы для магазинов
export const createStoreSchema = z.object({
  name: z.string()
    .min(1, 'Название магазина обязательно')
    .max(100, 'Название слишком длинное')
    .trim(),
  address: z.string()
    .min(5, 'Адрес должен содержать минимум 5 символов')
    .max(200, 'Адрес слишком длинный')
    .trim()
});

export const updateStoreSchema = createStoreSchema.partial();

// Схемы для категорий
export const createCategorySchema = z.object({
  name: z.string()
    .min(1, 'Название категории обязательно')
    .max(50, 'Название слишком длинное')
    .trim()
});

export const updateCategorySchema = createCategorySchema;

// Схемы для складских операций
export const createStockMovementSchema = z.object({
  productId: z.number().min(1, 'ID продукта должен быть положительным'),
  quantity: z.number().min(1, 'Количество должно быть больше 0').max(10000, 'Слишком большое количество'),
  type: z.enum(['INCOME', 'OUTCOME'], {
    message: 'Тип должен быть INCOME или OUTCOME'
  })
});

// Схемы для статусов заказов
export const updateOrderStatusSchema = z.object({
  status: z.enum([
    'PENDING',
    'CONFIRMED', 
    'PREPARING',
    'READY',
    'DELIVERING',
    'DELIVERED',
    'CANCELLED'
  ], {
    message: 'Неверный статус заказа'
  })
});

// Схемы для адресов пользователей
export const createUserAddressSchema = z.object({
  address: z.string()
    .min(5, 'Адрес должен содержать минимум 5 символов')
    .max(500, 'Адрес слишком длинный')
    .trim()
});

// Схемы для курьеров
export const assignCourierSchema = z.object({
  orderId: z.number().min(1, 'ID заказа должен быть положительным'),
  courierId: z.number().min(1, 'ID курьера должен быть положительным')
});

export const courierOrderStatusSchema = z.object({
  status: z.literal('DELIVERED', {
    message: 'Курьер может изменить статус только на DELIVERED'
  })
});

// Утилиты для валидации
export type ValidationSchema = z.ZodSchema<any>;

export const validateSchema = <T>(schema: z.ZodSchema<T>) => {
  return (data: unknown): T => {
    const result = schema.safeParse(data);
    if (!result.success) {
      const errors = result.error.issues.map((err: any) => 
        `${err.path.join('.')}: ${err.message}`
      ).join(', ');
      throw new Error(`Ошибки валидации: ${errors}`);
    }
    return result.data;
  };
};
