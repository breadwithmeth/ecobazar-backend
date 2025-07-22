"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const authController_1 = require("../controllers/authController");
const validation_1 = require("../middlewares/validation");
const router = (0, express_1.Router)();
// Регистрация или вход через Telegram
router.post('/', (0, validation_1.validateBody)({
    telegram_user_id: {
        required: true,
        custom: (value) => {
            // Проверяем, что это строка или число
            if (typeof value !== 'string' && typeof value !== 'number') {
                return 'telegram_user_id должен быть строкой или числом';
            }
            // Конвертируем в строку и проверяем формат
            const str = String(value);
            if (!/^\d+$/.test(str)) {
                return 'telegram_user_id должен содержать только цифры';
            }
            // Проверяем длину (ID Telegram обычно от 5 до 15 символов)
            if (str.length < 3 || str.length > 15) {
                return 'telegram_user_id должен содержать от 5 до 15 цифр';
            }
            return true;
        }
    }
}), authController_1.registerOrLogin);
exports.default = router;
