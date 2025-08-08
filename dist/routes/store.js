"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const storeControllerV2_1 = require("../controllers/storeControllerV2");
const auth_1 = require("../middlewares/auth");
const router = (0, express_1.Router)();
// Публичные роуты
router.get('/', storeControllerV2_1.getStores);
router.get('/:id', storeControllerV2_1.getStore);
// Роуты для SELLER
router.get('/my/store', auth_1.authenticate, auth_1.isSeller, storeControllerV2_1.getMyStore);
router.put('/my/store', auth_1.authenticate, auth_1.isSeller, storeControllerV2_1.updateMyStore);
router.get('/my/orders', auth_1.authenticate, auth_1.isSeller, storeControllerV2_1.getStoreOrders);
router.get('/my/order-items', auth_1.authenticate, auth_1.isSeller, storeControllerV2_1.getStoreOrderItems);
router.put('/my/order-items/:orderItemId/confirm', auth_1.authenticate, auth_1.isSeller, storeControllerV2_1.confirmOrderItem);
router.get('/my/stats', auth_1.authenticate, auth_1.isSeller, storeControllerV2_1.getStoreStats);
// Роуты для ADMIN
router.post('/', auth_1.authenticate, auth_1.isAdmin, storeControllerV2_1.createStore);
router.put('/:id', auth_1.authenticate, storeControllerV2_1.updateStore);
router.post('/:id/assign-owner', auth_1.authenticate, auth_1.isAdmin, storeControllerV2_1.assignStoreOwner);
router.delete('/:id', auth_1.authenticate, auth_1.isAdmin, storeControllerV2_1.deleteStore);
exports.default = router;
