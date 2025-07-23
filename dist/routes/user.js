"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const userController_1 = require("../controllers/userController");
const auth_1 = require("../middlewares/auth");
const router = (0, express_1.Router)();
// Получить свой профиль
router.get('/me', auth_1.authenticate, userController_1.getMe);
// Обновить свой профиль
router.patch('/me', auth_1.authenticate, userController_1.updateMe);
// Получить всех пользователей (только для администраторов)
router.get('/admin/all', auth_1.authenticate, auth_1.isAdmin, userController_1.getAllUsers);
exports.default = router;
