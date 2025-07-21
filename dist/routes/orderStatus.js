"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const orderStatusController_1 = require("../controllers/orderStatusController");
const auth_1 = require("../middlewares/auth");
const router = (0, express_1.Router)();
router.get('/:orderId/statuses', auth_1.authenticate, orderStatusController_1.getOrderStatuses);
router.post('/:orderId/statuses', auth_1.authenticate, auth_1.isAdmin, orderStatusController_1.addOrderStatus);
exports.default = router;
