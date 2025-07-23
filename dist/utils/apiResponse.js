"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.FilterUtil = exports.PaginationUtil = exports.ApiResponseUtil = void 0;
class ApiResponseUtil {
    static success(res, data, message, statusCode = 200) {
        const response = {
            success: true,
            data,
            message
        };
        res.status(statusCode).json(response);
    }
    static created(res, data, message) {
        this.success(res, data, message || 'Ресурс успешно создан', 201);
    }
    static error(res, error, statusCode = 400) {
        const response = {
            success: false,
            error
        };
        res.status(statusCode).json(response);
    }
    static notFound(res, message = 'Ресурс не найден') {
        this.error(res, message, 404);
    }
    static unauthorized(res, message = 'Не авторизован') {
        this.error(res, message, 401);
    }
    static forbidden(res, message = 'Доступ запрещен') {
        this.error(res, message, 403);
    }
    static paginated(res, data, meta, message) {
        const response = {
            success: true,
            data,
            message,
            meta: Object.assign(Object.assign({}, meta), { totalPages: Math.ceil(meta.total / meta.limit) })
        };
        res.status(200).json(response);
    }
}
exports.ApiResponseUtil = ApiResponseUtil;
class PaginationUtil {
    static getSkipTake(page = 1, limit = 10) {
        const skip = (page - 1) * limit;
        const take = limit;
        return { skip, take };
    }
    static parseQuery(query) {
        const page = parseInt(query.page) || 1;
        const limit = Math.min(parseInt(query.limit) || 10, 100); // Максимум 100 записей
        const sortBy = query.sortBy || 'createdAt'; // По умолчанию сортируем по дате создания
        const sortOrder = query.sortOrder === 'asc' ? 'asc' : 'desc'; // По умолчанию сортируем от новых к старым
        return { page, limit, sortBy, sortOrder };
    }
    static buildOrderBy(sortBy, sortOrder) {
        return { [sortBy]: sortOrder };
    }
}
exports.PaginationUtil = PaginationUtil;
// Утилиты для фильтрации
class FilterUtil {
    static buildDateFilter(dateStr) {
        if (!dateStr)
            return undefined;
        const date = new Date(dateStr);
        if (isNaN(date.getTime()))
            return undefined;
        return {
            gte: new Date(date.getFullYear(), date.getMonth(), date.getDate()),
            lt: new Date(date.getFullYear(), date.getMonth(), date.getDate() + 1)
        };
    }
    static buildStringFilter(value, exact = false) {
        if (!value)
            return undefined;
        return exact ? value : {
            contains: value,
            mode: 'insensitive'
        };
    }
    static buildNumberFilter(value) {
        if (value === undefined || value === null || value === '')
            return undefined;
        const num = typeof value === 'string' ? parseFloat(value) : value;
        return isNaN(num) ? undefined : num;
    }
    static buildArrayFilter(values) {
        if (!values)
            return undefined;
        const array = Array.isArray(values) ? values : [values];
        return array.length > 0 ? { in: array } : undefined;
    }
}
exports.FilterUtil = FilterUtil;
