"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const orderController_1 = require("../controllers/orderController");
const orderStatusController_1 = require("../controllers/orderStatusController");
const auth_1 = require("../middlewares/auth");
const validation_1 = require("../middlewares/validation");
const router = (0, express_1.Router)();
// Создать заказ (для авторизованных пользователей)
router.post('/', auth_1.authenticate, (0, validation_1.validateBody)(validation_1.schemas.createOrder), orderController_1.createOrder);
// Получить свои заказы (для авторизованных пользователей)
router.get('/', auth_1.authenticate, orderController_1.getOrders);
// Получить конкретный заказ (для авторизованных пользователей)
router.get('/:id', auth_1.authenticate, (0, validation_1.validateParams)(validation_1.schemas.id), orderController_1.getOrder);
// Получить все заказы (только для администраторов)
router.get('/admin/all', auth_1.authenticate, auth_1.isAdmin, orderController_1.getAllOrders);
// Изменить статус заказа (только для администраторов)
router.put('/:id/status', auth_1.authenticate, auth_1.isAdmin, (0, validation_1.validateParams)(validation_1.schemas.id), (0, validation_1.validateBody)({
    status: {
        required: true,
        type: 'string',
        custom: (value) => {
            const allowedStatuses = ['NEW', 'WAITING_PAYMENT', 'PREPARING', 'DELIVERING', 'DELIVERED', 'CANCELLED'];
            return allowedStatuses.includes(value) || `Статус должен быть одним из: ${allowedStatuses.join(', ')}`;
        }
    }
}), orderStatusController_1.updateOrderStatus);
exports.default = router;
