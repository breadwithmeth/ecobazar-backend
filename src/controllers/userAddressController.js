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
exports.deleteAddress = exports.addAddress = exports.getAddresses = void 0;
const getAddresses = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    if (!req.user)
        return res.status(401).json({ message: 'Не авторизован' });
    const addresses = yield prisma.userAddress.findMany({
        where: { userId: req.user.id },
        select: { id: true, address: true },
    });
    res.json(addresses);
});
exports.getAddresses = getAddresses;
const client_1 = require("@prisma/client");
const prisma = new client_1.PrismaClient();
const addAddress = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { address } = req.body;
    if (!address)
        return res.status(400).json({ message: 'address обязателен' });
    if (!req.user)
        return res.status(401).json({ message: 'Не авторизован' });
    const newAddress = yield prisma.userAddress.create({
        data: {
            userId: req.user.id,
            address,
        },
    });
    res.status(201).json(newAddress);
});
exports.addAddress = addAddress;
const deleteAddress = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { id } = req.params;
    if (!req.user)
        return res.status(401).json({ message: 'Не авторизован' });
    const address = yield prisma.userAddress.findUnique({ where: { id: Number(id) } });
    if (!address || address.userId !== req.user.id) {
        return res.status(404).json({ message: 'Адрес не найден или не принадлежит пользователю' });
    }
    yield prisma.userAddress.delete({ where: { id: Number(id) } });
    res.json({ success: true });
});
exports.deleteAddress = deleteAddress;
