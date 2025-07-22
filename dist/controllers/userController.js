"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getMe = exports.updateMe = exports.changeUserRole = exports.getAllUsers = void 0;
const client_1 = require("@prisma/client");
const apiResponse_1 = require("../utils/apiResponse");
const errorHandler_1 = require("../middlewares/errorHandler");
const prisma = new client_1.PrismaClient();
// Получить всех пользователей (только для администраторов)
const getAllUsers = (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { page, limit, sortBy, sortOrder } = apiResponse_1.PaginationUtil.parseQuery(req.query);
        const { skip, take } = apiResponse_1.PaginationUtil.getSkipTake(page, limit);
        // Фильтрация по роли
        const roleFilter = req.query.role;
        const searchFilter = req.query.search;
        const whereClause = {};
        if (roleFilter) {
            whereClause.role = roleFilter;
        }
        if (searchFilter) {
            whereClause.OR = [
                { name: { contains: searchFilter, mode: 'insensitive' } },
                { phone_number: { contains: searchFilter } },
                { telegram_user_id: { contains: searchFilter } }
            ];
        }
        const total = yield prisma.user.count({ where: whereClause });
        const users = yield prisma.user.findMany({
            where: whereClause,
            skip,
            take,
            orderBy: apiResponse_1.PaginationUtil.buildOrderBy(sortBy || 'id', sortOrder || 'desc'),
            select: {
                id: true,
                telegram_user_id: true,
                name: true,
                phone_number: true,
                role: true,
                _count: {
                    select: {
                        orders: true,
                        deliveredOrders: true
                    }
                }
            }
        });
        // Добавляем дополнительную статистику для курьеров
        const usersWithStats = yield Promise.all(users.map((user) => __awaiter(void 0, void 0, void 0, function* () {
            if (user.role === 'COURIER') {
                const activeOrders = yield prisma.order.count({
                    where: {
                        courierId: user.id,
                        statuses: {
                            some: {
                                status: {
                                    in: ['CONFIRMED', 'PREPARING', 'READY', 'DELIVERING']
                                }
                            }
                        }
                    }
                });
                return Object.assign(Object.assign({}, user), { stats: {
                        totalOrders: user._count.orders,
                        deliveredOrders: user._count.deliveredOrders,
                        activeOrders
                    } });
            }
            return Object.assign(Object.assign({}, user), { stats: {
                    totalOrders: user._count.orders
                } });
        })));
        apiResponse_1.ApiResponseUtil.paginated(res, usersWithStats, {
            page: page || 1,
            limit: limit || 20,
            total
        });
    }
    catch (error) {
        next(error);
    }
});
exports.getAllUsers = getAllUsers;
// Изменить роль пользователя (только для администраторов)
const changeUserRole = (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { id } = req.params;
        const { role } = req.body;
        const userId = parseInt(id);
        if (isNaN(userId)) {
            throw new errorHandler_1.AppError('Неверный ID пользователя', 400);
        }
        // Валидация роли
        const allowedRoles = ['CUSTOMER', 'COURIER', 'ADMIN'];
        if (!allowedRoles.includes(role)) {
            throw new errorHandler_1.AppError(`Роль должна быть одной из: ${allowedRoles.join(', ')}`, 400);
        }
        // Проверяем существование пользователя
        const user = yield prisma.user.findUnique({
            where: { id: userId },
            select: { id: true, role: true, name: true, telegram_user_id: true }
        });
        if (!user) {
            throw new errorHandler_1.AppError('Пользователь не найден', 404);
        }
        // Проверяем, что роль действительно изменяется
        if (user.role === role) {
            throw new errorHandler_1.AppError(`Пользователь уже имеет роль ${role}`, 400);
        }
        const oldRole = user.role;
        // Обновляем роль пользователя
        const updatedUser = yield prisma.user.update({
            where: { id: userId },
            data: { role },
            select: { id: true, role: true, name: true, telegram_user_id: true }
        });
        // Инвалидируем кэш пользователей
        // (здесь можно добавить инвалидацию кэша, если используется)
        console.log(`👤 Роль пользователя ${userId} изменена с ${oldRole} на ${role} администратором ${req.user.id}`);
        apiResponse_1.ApiResponseUtil.success(res, {
            userId: updatedUser.id,
            oldRole,
            newRole: updatedUser.role,
            updatedAt: new Date().toISOString(),
            user: {
                id: updatedUser.id,
                name: updatedUser.name,
                telegram_user_id: updatedUser.telegram_user_id
            }
        }, 'Роль пользователя успешно изменена');
    }
    catch (error) {
        next(error);
    }
});
exports.changeUserRole = changeUserRole;
// PATCH /api/user/me — обновить имя и номер телефона
const updateMe = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    if (!req.user)
        return res.status(401).json({ message: 'Не авторизован' });
    const { name, phone_number } = req.body;
    if (!name && !phone_number)
        return res.status(400).json({ message: 'Нужно передать name или phone_number' });
    const updated = yield prisma.user.update({
        where: { id: req.user.id },
        data: Object.assign(Object.assign({}, (name !== undefined ? { name } : {})), (phone_number !== undefined ? { phone_number } : {}))
    });
    res.json({ id: updated.id, telegram_user_id: updated.telegram_user_id, role: updated.role, phone_number: updated.phone_number, name: updated.name });
});
exports.updateMe = updateMe;
const getMe = (req, res) => {
    if (!req.user)
        return res.status(401).json({ message: 'Не авторизован' });
    const { id, telegram_user_id, role, phone_number, name } = req.user;
    res.json({ id, telegram_user_id, role, phone_number, name });
};
exports.getMe = getMe;
