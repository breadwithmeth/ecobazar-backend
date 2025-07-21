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
exports.getStores = exports.createStore = void 0;
const client_1 = require("@prisma/client");
const prisma = new client_1.PrismaClient();
const createStore = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { name, address } = req.body;
    if (!name || !address)
        return res.status(400).json({ message: 'Имя и адрес обязательны' });
    const store = yield prisma.store.create({ data: { name, address } });
    res.status(201).json(store);
});
exports.createStore = createStore;
const getStores = (_req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const stores = yield prisma.store.findMany();
    res.json(stores);
});
exports.getStores = getStores;
