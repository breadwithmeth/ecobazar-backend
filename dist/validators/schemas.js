"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.validateSchema = exports.courierOrderStatusSchema = exports.assignCourierSchema = exports.createUserAddressSchema = exports.updateOrderStatusSchema = exports.createStockMovementSchema = exports.updateCategorySchema = exports.createCategorySchema = exports.storeConfirmationSchema = exports.assignStoreOwnerSchema = exports.storeFilterSchema = exports.updateStoreSchema = exports.createStoreSchema = exports.updateUserSchema = exports.createUserSchema = exports.orderFilterSchema = exports.createOrderSchema = exports.orderItemSchema = exports.productFilterSchema = exports.updateProductSchema = exports.createProductSchema = exports.paginationSchema = exports.idSchema = void 0;
const zod_1 = require("zod");
// Базовые схемы
exports.idSchema = zod_1.z.object({
    id: zod_1.z.string().regex(/^\d+$/, 'ID должен быть числом').transform(Number)
});
exports.paginationSchema = zod_1.z.object({
    page: zod_1.z.string().optional().transform((val) => val ? parseInt(val) || 1 : 1),
    limit: zod_1.z.string().optional().transform((val) => {
        const num = val ? parseInt(val) : 10;
        return Math.min(Math.max(num, 1), 100); // От 1 до 100
    }),
    sortBy: zod_1.z.string().optional().default('id'),
    sortOrder: zod_1.z.enum(['asc', 'desc']).optional().default('asc')
});
// Схемы для продуктов
exports.createProductSchema = zod_1.z.object({
    name: zod_1.z.string()
        .min(1, 'Название обязательно')
        .max(200, 'Название не должно превышать 200 символов')
        .trim(),
    price: zod_1.z.number()
        .min(0, 'Цена не может быть отрицательной')
        .max(1000000, 'Цена слишком большая'),
    storeId: zod_1.z.number()
        .min(1, 'ID магазина должен быть положительным'),
    image: zod_1.z.string()
        .max(500, 'URL изображения слишком длинный')
        .url('Неверный формат URL')
        .optional(),
    categoryId: zod_1.z.number()
        .min(1, 'ID категории должен быть положительным')
        .optional()
});
exports.updateProductSchema = exports.createProductSchema.partial();
exports.productFilterSchema = zod_1.z.object({
    search: zod_1.z.string().optional(),
    storeId: zod_1.z.string().transform(Number).optional(),
    categoryId: zod_1.z.string().transform(Number).optional(),
    minPrice: zod_1.z.string().transform(Number).optional(),
    maxPrice: zod_1.z.string().transform(Number).optional()
});
// Схемы для заказов
exports.orderItemSchema = zod_1.z.object({
    productId: zod_1.z.number().min(1, 'ID продукта должен быть положительным'),
    quantity: zod_1.z.number().min(1, 'Количество должно быть больше 0').max(100, 'Слишком большое количество'),
    price: zod_1.z.number().min(0).optional()
});
exports.createOrderSchema = zod_1.z.object({
    items: zod_1.z.array(exports.orderItemSchema)
        .min(1, 'Заказ должен содержать хотя бы один товар')
        .max(50, 'Слишком много товаров в заказе'),
    address: zod_1.z.string()
        .min(5, 'Адрес должен содержать минимум 5 символов')
        .max(500, 'Адрес слишком длинный')
        .trim(),
    deliveryType: zod_1.z.enum(['ASAP', 'SCHEDULED'])
        .default('ASAP'),
    scheduledDate: zod_1.z.string()
        .datetime({ message: 'Неверный формат даты и времени' })
        .transform((str) => new Date(str))
        .optional()
        .refine((date) => {
        if (!date)
            return true;
        const now = new Date();
        const minDate = new Date(now.getTime() + 30 * 60 * 1000); // Минимум через 30 минут
        const maxDate = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000); // Максимум через 7 дней
        return date >= minDate && date <= maxDate;
    }, 'Дата доставки должна быть от 30 минут до 7 дней от текущего времени')
}).refine((data) => {
    if (data.deliveryType === 'SCHEDULED' && !data.scheduledDate) {
        return false;
    }
    return true;
}, {
    message: 'При выборе запланированной доставки необходимо указать дату и время',
    path: ['scheduledDate']
});
exports.orderFilterSchema = zod_1.z.object({
    status: zod_1.z.string().optional(),
    userId: zod_1.z.string().transform((str) => Number(str)).optional(),
    dateFrom: zod_1.z.string().transform((str) => new Date(str)).optional(),
    dateTo: zod_1.z.string().transform((str) => new Date(str)).optional()
});
// Схемы для пользователей
exports.createUserSchema = zod_1.z.object({
    telegram_user_id: zod_1.z.string()
        .regex(/^\d+$/, 'telegram_user_id должен содержать только цифры')
        .min(5, 'telegram_user_id должен содержать минимум 5 цифр')
        .max(15, 'telegram_user_id должен содержать максимум 15 цифр')
});
exports.updateUserSchema = zod_1.z.object({
    name: zod_1.z.string()
        .min(1, 'Имя не может быть пустым')
        .max(100, 'Имя слишком длинное')
        .trim()
        .optional(),
    phone_number: zod_1.z.string()
        .regex(/^\+?[1-9]\d{1,14}$/, 'Неверный формат номера телефона')
        .optional()
}).refine((data) => data.name !== undefined || data.phone_number !== undefined, {
    message: 'Необходимо указать имя или номер телефона'
});
// Схемы для магазинов
exports.createStoreSchema = zod_1.z.object({
    name: zod_1.z.string()
        .min(1, 'Название магазина обязательно')
        .max(100, 'Название слишком длинное')
        .trim(),
    address: zod_1.z.string()
        .min(5, 'Адрес должен содержать минимум 5 символов')
        .max(200, 'Адрес слишком длинный')
        .trim(),
    ownerId: zod_1.z.number()
        .min(1, 'ID владельца должен быть положительным')
        .optional()
});
exports.updateStoreSchema = exports.createStoreSchema.partial();
exports.storeFilterSchema = zod_1.z.object({
    search: zod_1.z.string().optional(),
    ownerId: zod_1.z.string().transform(Number).optional()
});
exports.assignStoreOwnerSchema = zod_1.z.object({
    ownerId: zod_1.z.union([
        zod_1.z.number(),
        zod_1.z.string().transform(Number)
    ]).refine(val => val > 0, 'ID владельца должен быть положительным')
});
// Схемы для подтверждения заказов магазинами
exports.storeConfirmationSchema = zod_1.z.object({
    status: zod_1.z.enum(['CONFIRMED', 'PARTIAL', 'REJECTED']),
    confirmedQuantity: zod_1.z.number()
        .min(0, 'Подтвержденное количество не может быть отрицательным')
        .optional(),
    notes: zod_1.z.string()
        .max(500, 'Примечание не должно превышать 500 символов')
        .optional()
});
// Схемы для категорий
exports.createCategorySchema = zod_1.z.object({
    name: zod_1.z.string()
        .min(1, 'Название категории обязательно')
        .max(50, 'Название слишком длинное')
        .trim()
});
exports.updateCategorySchema = exports.createCategorySchema;
// Схемы для складских операций
exports.createStockMovementSchema = zod_1.z.object({
    productId: zod_1.z.number().min(1, 'ID продукта должен быть положительным'),
    quantity: zod_1.z.number().min(1, 'Количество должно быть больше 0').max(10000, 'Слишком большое количество'),
    type: zod_1.z.enum(['INCOME', 'OUTCOME'], {
        message: 'Тип должен быть INCOME или OUTCOME'
    })
});
// Схемы для статусов заказов
exports.updateOrderStatusSchema = zod_1.z.object({
    status: zod_1.z.enum([
        'NEW',
        'WAITING_PAYMENT',
        'PREPARING',
        'DELIVERING',
        'DELIVERED',
        'CANCELLED'
    ], {
        message: 'Неверный статус заказа'
    })
});
// Схемы для адресов пользователей
exports.createUserAddressSchema = zod_1.z.object({
    address: zod_1.z.string()
        .min(5, 'Адрес должен содержать минимум 5 символов')
        .max(500, 'Адрес слишком длинный')
        .trim()
});
// Схемы для курьеров
exports.assignCourierSchema = zod_1.z.object({
    orderId: zod_1.z.number().min(1, 'ID заказа должен быть положительным'),
    courierId: zod_1.z.number().min(1, 'ID курьера должен быть положительным')
});
exports.courierOrderStatusSchema = zod_1.z.object({
    status: zod_1.z.literal('DELIVERED', {
        message: 'Курьер может изменить статус только на DELIVERED'
    })
});
const validateSchema = (schema) => {
    return (data) => {
        const result = schema.safeParse(data);
        if (!result.success) {
            const errors = result.error.issues.map((err) => `${err.path.join('.')}: ${err.message}`).join(', ');
            throw new Error(`Ошибки валидации: ${errors}`);
        }
        return result.data;
    };
};
exports.validateSchema = validateSchema;
