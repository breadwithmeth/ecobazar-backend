"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.updateProductPrice = void 0;
const client_1 = require("@prisma/client");
const prisma = new client_1.PrismaClient();
const updateProductPrice = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { id } = req.params;
        const { price } = req.body;
        if (typeof price !== 'number' || price < 0) {
            return res.status(400).json({ error: 'Некорректная цена' });
        }
        const product = yield prisma.product.update({
            where: { id: Number(id) },
            data: { price },
        });
        res.json(product);
    }
    catch (error) {
        res.status(404).json({ error: 'Товар не найден' });
    }
});
exports.updateProductPrice = updateProductPrice;
