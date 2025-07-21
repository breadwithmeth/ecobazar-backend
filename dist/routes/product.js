"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const productController_1 = require("../controllers/productController");
const productPriceController_1 = require("../controllers/productPriceController");
const auth_1 = require("../middlewares/auth");
const router = (0, express_1.Router)();
router.get('/', productController_1.getProducts);
router.post('/', auth_1.authenticate, auth_1.isAdmin, productController_1.createProduct);
// PATCH /api/products/:id/price — изменить цену товара (только ADMIN)
router.patch('/:id/price', auth_1.authenticate, auth_1.isAdmin, productPriceController_1.updateProductPrice);
exports.default = router;
