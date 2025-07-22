"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const userController_1 = require("../controllers/userController");
const auth_1 = require("../middlewares/auth");
const security_1 = require("../middlewares/security");
const validation_1 = require("../middlewares/validation");
const router = (0, express_1.Router)();
// Изменить роль пользователя
router.post('/users/:id/role', security_1.adminRateLimit, auth_1.authenticate, auth_1.isAdmin, (0, validation_1.validateParams)(validation_1.schemas.id), (0, validation_1.validateBody)({
    role: {
        required: true,
        type: 'string',
        custom: (value) => {
            const allowedRoles = ['CUSTOMER', 'COURIER', 'ADMIN'];
            return allowedRoles.includes(value) || `Роль должна быть одной из: ${allowedRoles.join(', ')}`;
        }
    }
}), userController_1.changeUserRole);
exports.default = router;
