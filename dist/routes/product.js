"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const productController_1 = require("../controllers/productController");
const productPriceController_1 = require("../controllers/productPriceController");
const auth_1 = require("../middlewares/auth");
const validation_1 = require("../middlewares/validation");
const router = (0, express_1.Router)();
// Получить все товары с пагинацией (публичный доступ)
router.get('/', productController_1.getProducts);
// Получить ВСЕ товары сразу без пагинации (публичный доступ)
router.get('/all', productController_1.getAllProducts);
// Получить товар по ID (публичный доступ)
router.get('/:id', (0, validation_1.validateParams)(validation_1.schemas.id), productController_1.getProduct);
// Создать товар (только для администраторов)
router.post('/', auth_1.authenticate, auth_1.isAdmin, (0, validation_1.validateBody)(validation_1.schemas.createProduct), productController_1.createProduct);
// Обновить товар (только для администраторов)
router.put('/:id', auth_1.authenticate, auth_1.isAdmin, (0, validation_1.validateParams)(validation_1.schemas.id), (0, validation_1.validateBody)({
    name: { type: 'string', minLength: 1, maxLength: 200 },
    price: { type: 'number', min: 0 },
    storeId: { type: 'number', min: 1 },
    image: { type: 'string', maxLength: 500 },
    categoryId: { type: 'number', min: 1 }
}), productController_1.updateProduct);
// Удалить товар (только для администраторов)
router.delete('/:id', auth_1.authenticate, auth_1.isAdmin, (0, validation_1.validateParams)(validation_1.schemas.id), productController_1.deleteProduct);
// Изменить цену товара (только для администраторов)
router.patch('/:id/price', auth_1.authenticate, auth_1.isAdmin, (0, validation_1.validateParams)(validation_1.schemas.id), (0, validation_1.validateBody)({
    price: { required: true, type: 'number', min: 0 }
}), productPriceController_1.updateProductPrice);
exports.default = router;
