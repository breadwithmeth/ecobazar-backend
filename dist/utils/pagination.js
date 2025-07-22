"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PaginationUtil = void 0;
class PaginationUtil {
    static parseQuery(query) {
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
    static getSkipTake(page, limit) {
        const skip = (page - 1) * limit;
        const take = limit;
        return { skip, take };
    }
    static buildMeta(total, page, limit) {
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
    static buildOrderBy(sortBy, sortOrder) {
        return { [sortBy]: sortOrder };
    }
}
exports.PaginationUtil = PaginationUtil;
