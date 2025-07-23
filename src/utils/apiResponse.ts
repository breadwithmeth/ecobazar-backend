import { Response } from 'express';

interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  message?: string;
  error?: string;
  meta?: {
    page?: number;
    limit?: number;
    total?: number;
    totalPages?: number;
  };
}

export class ApiResponseUtil {
  static success<T>(res: Response, data?: T, message?: string, statusCode: number = 200): void {
    const response: ApiResponse<T> = {
      success: true,
      data,
      message
    };
    
    res.status(statusCode).json(response);
  }
  
  static created<T>(res: Response, data?: T, message?: string): void {
    this.success(res, data, message || 'Ресурс успешно создан', 201);
  }
  
  static error(res: Response, error: string, statusCode: number = 400): void {
    const response: ApiResponse = {
      success: false,
      error
    };
    
    res.status(statusCode).json(response);
  }
  
  static notFound(res: Response, message: string = 'Ресурс не найден'): void {
    this.error(res, message, 404);
  }
  
  static unauthorized(res: Response, message: string = 'Не авторизован'): void {
    this.error(res, message, 401);
  }
  
  static forbidden(res: Response, message: string = 'Доступ запрещен'): void {
    this.error(res, message, 403);
  }
  
  static paginated<T>(
    res: Response, 
    data: T[], 
    meta: { page: number; limit: number; total: number },
    message?: string
  ): void {
    const response: ApiResponse<T[]> = {
      success: true,
      data,
      message,
      meta: {
        ...meta,
        totalPages: Math.ceil(meta.total / meta.limit)
      }
    };
    
    res.status(200).json(response);
  }
}

// Хелперы для пагинации
export interface PaginationOptions {
  page?: number;
  limit?: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

export class PaginationUtil {
  static getSkipTake(page: number = 1, limit: number = 10) {
    const skip = (page - 1) * limit;
    const take = limit;
    return { skip, take };
  }
  
  static parseQuery(query: any): PaginationOptions {
    const page = parseInt(query.page) || 1;
    const limit = Math.min(parseInt(query.limit) || 10, 100); // Максимум 100 записей
    const sortBy = query.sortBy || 'createdAt'; // По умолчанию сортируем по дате создания
    const sortOrder = query.sortOrder === 'asc' ? 'asc' : 'desc'; // По умолчанию сортируем от новых к старым
    
    return { page, limit, sortBy, sortOrder };
  }
  
  static buildOrderBy(sortBy: string, sortOrder: 'asc' | 'desc') {
    return { [sortBy]: sortOrder };
  }
}

// Утилиты для фильтрации
export class FilterUtil {
  static buildDateFilter(dateStr?: string) {
    if (!dateStr) return undefined;
    
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) return undefined;
    
    return {
      gte: new Date(date.getFullYear(), date.getMonth(), date.getDate()),
      lt: new Date(date.getFullYear(), date.getMonth(), date.getDate() + 1)
    };
  }
  
  static buildStringFilter(value?: string, exact: boolean = false) {
    if (!value) return undefined;
    
    return exact ? value : {
      contains: value,
      mode: 'insensitive' as const
    };
  }
  
  static buildNumberFilter(value?: string | number) {
    if (value === undefined || value === null || value === '') return undefined;
    
    const num = typeof value === 'string' ? parseFloat(value) : value;
    return isNaN(num) ? undefined : num;
  }
  
  static buildArrayFilter(values?: string | string[]) {
    if (!values) return undefined;
    
    const array = Array.isArray(values) ? values : [values];
    return array.length > 0 ? { in: array } : undefined;
  }
}
