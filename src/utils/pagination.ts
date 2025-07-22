import { Request } from 'express';

export interface PaginationQuery {
  page?: string;
  limit?: string;
  sortBy?: string;
  sortOrder?: string;
}

export interface ParsedPagination {
  page: number;
  limit: number;
  sortBy?: string;
  sortOrder: 'asc' | 'desc';
}

export interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  hasNext: boolean;
  hasPrev: boolean;
}

export class PaginationUtil {
  static parseQuery(query: any): ParsedPagination {
    const page = parseInt(query.page) || 1;
    const limit = Math.min(parseInt(query.limit) || 10, 100); // Максимум 100 записей
    const sortBy = query.sortBy || 'id';
    const sortOrder = query.sortOrder === 'desc' ? 'desc' : 'asc';
    
    return {
      page: Math.max(page, 1),
      limit: Math.max(limit, 1),
      sortBy,
      sortOrder
    };
  }
  
  static getSkipTake(page: number, limit: number) {
    const skip = (page - 1) * limit;
    const take = limit;
    
    return { skip, take };
  }
  
  static buildMeta(total: number, page: number, limit: number): PaginationMeta {
    const totalPages = Math.ceil(total / limit);
    
    return {
      page,
      limit,
      total,
      totalPages,
      hasNext: page < totalPages,
      hasPrev: page > 1
    };
  }
  
  static buildOrderBy(sortBy: string, sortOrder: 'asc' | 'desc') {
    return { [sortBy]: sortOrder };
  }
}
