"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const courierControllerV2_1 = require("../controllers/courierControllerV2");
const auth_1 = require("../middlewares/auth");
const router = (0, express_1.Router)();
// Маршруты для курьеров
router.get('/orders', auth_1.authenticate, auth_1.isCourier, courierControllerV2_1.getCourierOrders);
router.get('/stats', auth_1.authenticate, auth_1.isCourier, courierControllerV2_1.getCourierStats);
router.put('/orders/:id/status', auth_1.authenticate, auth_1.isCourier, courierControllerV2_1.updateOrderStatusByCourier);
// Маршруты для админов (управление курьерами)
router.get('/list', auth_1.authenticate, auth_1.isAdmin, courierControllerV2_1.getCouriers);
router.get('/:id/stats', auth_1.authenticate, auth_1.isAdmin, courierControllerV2_1.getCourierStatsById);
router.post('/assign', auth_1.authenticate, auth_1.isAdmin, courierControllerV2_1.assignCourierToOrder);
exports.default = router;
