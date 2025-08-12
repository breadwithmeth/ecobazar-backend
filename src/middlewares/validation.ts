import { Request, Response, NextFunction } from 'express';
import { AppError } from './errorHandler';

export interface ValidationSchema {
  [key: string]: {
    required?: boolean;
    type?: 'string' | 'number' | 'boolean' | 'array' | 'object';
    minLength?: number;
    maxLength?: number;
    min?: number;
    max?: number;
    pattern?: RegExp;
    custom?: (value: any) => boolean | string;
  };
}

export const validateBody = (schema: ValidationSchema) => {
  return (req: Request, res: Response, next: NextFunction) => {
    try {
      const errors: string[] = [];
      
      for (const [field, rules] of Object.entries(schema)) {
        const value = req.body[field];
        
        // Проверка обязательности
        if (rules.required && (value === undefined || value === null || value === '')) {
          errors.push(`Поле ${field} обязательно`);
          continue;
        }
        
        // Если поле не обязательное и пустое, пропускаем остальные проверки
        if (!rules.required && (value === undefined || value === null || value === '')) {
          continue;
        }
        
        // Проверка типа
        if (rules.type && !checkType(value, rules.type)) {
          errors.push(`Поле ${field} должно быть типа ${rules.type}`);
          continue;
        }
        
        // Проверка минимальной длины
        if (rules.minLength && typeof value === 'string' && value.length < rules.minLength) {
          errors.push(`Поле ${field} должно содержать минимум ${rules.minLength} символов`);
        }
        
        // Проверка максимальной длины
        if (rules.maxLength && typeof value === 'string' && value.length > rules.maxLength) {
          errors.push(`Поле ${field} должно содержать максимум ${rules.maxLength} символов`);
        }
        
        // Проверка минимального значения
        if (rules.min && typeof value === 'number' && value < rules.min) {
          errors.push(`Поле ${field} должно быть больше или равно ${rules.min}`);
        }
        
        // Проверка максимального значения
        if (rules.max && typeof value === 'number' && value > rules.max) {
          errors.push(`Поле ${field} должно быть меньше или равно ${rules.max}`);
        }
        
        // Проверка регулярного выражения
        if (rules.pattern && typeof value === 'string' && !rules.pattern.test(value)) {
          errors.push(`Поле ${field} имеет неверный формат`);
        }
        
        // Кастомная валидация
        if (rules.custom) {
          const result = rules.custom(value);
          if (typeof result === 'string') {
            errors.push(result);
          } else if (!result) {
            errors.push(`Поле ${field} не прошло валидацию`);
          }
        }
      }
      
      if (errors.length > 0) {
        throw new AppError(`Ошибки валидации: ${errors.join(', ')}`, 400);
      }
      
      next();
    } catch (error) {
      next(error);
    }
  };
};

export const validateParams = (schema: ValidationSchema) => {
  return (req: Request, res: Response, next: NextFunction) => {
    try {
      const errors: string[] = [];
      
      for (const [field, rules] of Object.entries(schema)) {
        const value = req.params[field];
        
        if (rules.required && !value) {
          errors.push(`Параметр ${field} обязателен`);
          continue;
        }
        
        if (rules.type && value && !checkType(value, rules.type)) {
          errors.push(`Параметр ${field} должен быть типа ${rules.type}`);
        }
        
        if (rules.custom && value) {
          const result = rules.custom(value);
          if (typeof result === 'string') {
            errors.push(result);
          } else if (!result) {
            errors.push(`Параметр ${field} не прошел валидацию`);
          }
        }
      }
      
      if (errors.length > 0) {
        throw new AppError(`Ошибки валидации параметров: ${errors.join(', ')}`, 400);
      }
      
      next();
    } catch (error) {
      next(error);
    }
  };
};

function checkType(value: any, expectedType: string): boolean {
  switch (expectedType) {
    case 'string':
      return typeof value === 'string';
    case 'number':
      return typeof value === 'number' && !isNaN(value);
    case 'boolean':
      return typeof value === 'boolean';
    case 'array':
      return Array.isArray(value);
    case 'object':
      return typeof value === 'object' && value !== null && !Array.isArray(value);
    default:
      return true;
  }
}

// Предустановленные схемы валидации
export const schemas = {
  id: {
    id: {
      required: true,
      custom: (value: string) => {
        const id = parseInt(value);
        return !isNaN(id) && id > 0;
      }
    }
  },
  
  createProduct: {
    name: { required: true, type: 'string' as const, minLength: 1, maxLength: 200 },
    price: { required: true, type: 'number' as const, min: 0 },
    storeId: { required: true, type: 'number' as const, min: 1 },
    image: { type: 'string' as const, maxLength: 500 },
    categoryId: { type: 'number' as const, min: 1 },
    unit: { type: 'string' as const, minLength: 1, maxLength: 20 } // добавлено
  },
  
  createOrder: {
    items: { 
      required: true, 
      type: 'array' as const,
      custom: (items: any[]) => {
        if (!Array.isArray(items) || items.length === 0) {
          return 'Заказ должен содержать хотя бы один товар';
        }
        for (const item of items) {
          if (!item.productId || !item.quantity || item.quantity <= 0) {
            return 'Каждый товар должен иметь productId и quantity > 0';
          }
        }
        return true;
      }
    },
    address: { required: true, type: 'string' as const, minLength: 5, maxLength: 500 },
    deliveryType: {
      required: false,
      type: 'string' as const,
      custom: (value: string) => {
        if (!value) return true; // Опциональное поле
        const allowedTypes = ['ASAP', 'SCHEDULED'];
        return allowedTypes.includes(value) || `Тип доставки должен быть одним из: ${allowedTypes.join(', ')}`;
      }
    },
    scheduledDate: {
      required: false,
      type: 'string' as const,
      custom: (value: string) => {
        if (!value) return true; // Если значение не передано, это валидно
        const date = new Date(value);
        if (isNaN(date.getTime())) {
          return 'Неверный формат даты и времени';
        }
        const now = new Date();
        const minDate = new Date(now.getTime() + 30 * 60 * 1000); // Минимум через 30 минут
        const maxDate = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000); // Максимум через 7 дней
        if (date < minDate || date > maxDate) {
          return 'Дата доставки должна быть от 30 минут до 7 дней от текущего времени';
        }
        return true;
      }
    }
  },
  
  updateUser: {
    name: { type: 'string' as const, minLength: 1, maxLength: 100 },
    phone_number: { 
      type: 'string' as const, 
      pattern: /^\+?[1-9]\d{1,14}$/
    }
  },
  
  createCategory: {
    name: { required: true, type: 'string' as const, minLength: 1, maxLength: 100 }
  }
};
