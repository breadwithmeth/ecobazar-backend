"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const orderController_1 = require("../controllers/orderController");
const orderStatusController_1 = require("../controllers/orderStatusController");
const auth_1 = require("../middlewares/auth");
const router = (0, express_1.Router)();
router.post('/', auth_1.authenticate, orderController_1.createOrder);
router.get('/', auth_1.authenticate, orderController_1.getOrders);
router.get('/all', auth_1.authenticate, auth_1.isAdmin, orderController_1.getAllOrders); // только для ADMIN
// PUT /api/orders/:id/status — сменить статус заказа (только ADMIN)
router.put('/:id/status', auth_1.authenticate, auth_1.isAdmin, orderStatusController_1.updateOrderStatus);
exports.default = router;
