"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const deliveryRatingController_1 = require("../controllers/deliveryRatingController");
const auth_1 = require("../middlewares/auth");
const zodValidation_1 = require("../middlewares/zodValidation");
const schemas_1 = require("../validators/schemas");
const router = (0, express_1.Router)();
// Создать оценку доставки (для клиентов)
router.post('/', auth_1.authenticate, (0, zodValidation_1.validateBody)(schemas_1.createDeliveryRatingSchema), deliveryRatingController_1.createDeliveryRating);
// Получить оценку доставки по заказу (для клиентов и админов)
router.get('/order/:id', auth_1.authenticate, (0, zodValidation_1.validateParams)(schemas_1.idSchema), deliveryRatingController_1.getDeliveryRating);
// Получить статистику оценок курьера (для админов)
router.get('/courier/:id/stats', auth_1.authenticate, auth_1.isAdmin, (0, zodValidation_1.validateParams)(schemas_1.idSchema), deliveryRatingController_1.getCourierRatingStats);
// Получить все оценки с фильтрацией (для админов)
router.get('/admin/all', auth_1.authenticate, auth_1.isAdmin, (0, zodValidation_1.validateQuery)(schemas_1.getRatingsQuerySchema), deliveryRatingController_1.getAllRatings);
exports.default = router;
