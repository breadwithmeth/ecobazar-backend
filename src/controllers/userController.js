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
exports.getMe = exports.updateMe = void 0;
// PATCH /api/user/me — обновить имя и номер телефона
const client_1 = require("@prisma/client");
const prisma = new client_1.PrismaClient();
const updateMe = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    if (!req.user)
        return res.status(401).json({ message: 'Не авторизован' });
    const { name, phone_number } = req.body;
    if (!name && !phone_number)
        return res.status(400).json({ message: 'Нужно передать name или phone_number' });
    const updated = yield prisma.user.update({
        where: { id: req.user.id },
        data: Object.assign(Object.assign({}, (name !== undefined ? { name } : {})), (phone_number !== undefined ? { phone_number } : {}))
    });
    res.json({ id: updated.id, telegram_user_id: updated.telegram_user_id, role: updated.role, phone_number: updated.phone_number, name: updated.name });
});
exports.updateMe = updateMe;
const getMe = (req, res) => {
    if (!req.user)
        return res.status(401).json({ message: 'Не авторизован' });
    const { id, telegram_user_id, role, phone_number, name } = req.user;
    res.json({ id, telegram_user_id, role, phone_number, name });
};
exports.getMe = getMe;
