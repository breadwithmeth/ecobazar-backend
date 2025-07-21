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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.registerOrLogin = void 0;
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const client_1 = require("@prisma/client");
const prisma = new client_1.PrismaClient();
const registerOrLogin = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { telegram_user_id } = req.body;
    if (!telegram_user_id) {
        return res.status(400).json({ message: 'telegram_user_id обязателен' });
    }
    let user = yield prisma.user.findUnique({ where: { telegram_user_id: String(telegram_user_id) } });
    if (user) {
        // Логин по telegram_user_id
        const token = jsonwebtoken_1.default.sign({ userId: user.id, role: user.role }, process.env.JWT_SECRET, { expiresIn: '7d' });
        return res.json({ token });
    }
    else {
        // Регистрация (role не передаётся, всегда CUSTOMER по умолчанию)
        user = yield prisma.user.create({ data: { telegram_user_id: String(telegram_user_id) } });
        const token = jsonwebtoken_1.default.sign({ userId: user.id, role: user.role }, process.env.JWT_SECRET, { expiresIn: '7d' });
        return res.status(201).json({ token });
    }
});
exports.registerOrLogin = registerOrLogin;
