"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const storeController_1 = require("../controllers/storeController");
const auth_1 = require("../middlewares/auth");
const router = (0, express_1.Router)();
router.get('/', storeController_1.getStores);
router.post('/', auth_1.authenticate, auth_1.isAdmin, storeController_1.createStore);
exports.default = router;
