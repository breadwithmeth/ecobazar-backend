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
const client_1 = require("@prisma/client");
const prisma = new client_1.PrismaClient();
function main() {
    return __awaiter(this, void 0, void 0, function* () {
        // Создание пользователей
        const admin = yield prisma.user.upsert({
            where: { telegram_user_id: '1001' },
            update: {},
            create: {
                telegram_user_id: '1001',
                role: 'ADMIN',
            },
        });
        const customer = yield prisma.user.upsert({
            where: { telegram_user_id: '2001' },
            update: {},
            create: {
                telegram_user_id: '2001',
                role: 'CUSTOMER',
            },
        });
        // Создание магазинов
        const stores = yield Promise.all([
            prisma.store.create({ data: { name: 'Магазин №1', address: 'ул. Ленина, 1' } }),
            prisma.store.create({ data: { name: 'Магазин №2', address: 'ул. Гагарина, 2' } }),
        ]);
        // Создание категорий
        const categoryNames = [
            'Фрукты',
            'Овощи',
            'Молочные продукты',
            'Мясо',
            'Крупы',
            'Напитки',
        ];
        const categories = yield Promise.all(categoryNames.map((name) => prisma.category.create({ data: { name } })));
        // 30 товаров, по 5 на каждую категорию, раскиданы по магазинам
        const productNames = [
            // Фрукты
            'Яблоки', 'Бананы', 'Апельсины', 'Груши', 'Виноград',
            // Овощи
            'Картофель', 'Морковь', 'Огурцы', 'Помидоры', 'Капуста',
            // Молочные продукты
            'Молоко', 'Сыр', 'Творог', 'Йогурт', 'Сметана',
            // Мясо
            'Говядина', 'Свинина', 'Курица', 'Баранина', 'Индейка',
            // Крупы
            'Рис', 'Гречка', 'Овсянка', 'Пшено', 'Перловка',
            // Напитки
            'Вода', 'Сок', 'Чай', 'Кофе', 'Лимонад',
        ];
        let products = [];
        for (let i = 0; i < 30; i++) {
            const category = categories[Math.floor(i / 5)];
            const store = stores[i % stores.length];
            const product = yield prisma.product.create({
                data: {
                    name: productNames[i],
                    price: 50 + i * 10,
                    storeId: store.id,
                    categoryId: category.id,
                },
            });
            products.push(product);
        }
        // Первичное поступление товаров
        yield prisma.stockMovement.createMany({
            data: products.map((product, idx) => ({
                productId: product.id,
                quantity: 20 + idx,
                type: 'INCOME',
                adminId: admin.id,
            })),
        });
        console.log('Данные успешно добавлены!');
    });
}
main()
    .catch((e) => {
    console.error(e);
    process.exit(1);
})
    .finally(() => __awaiter(void 0, void 0, void 0, function* () {
    yield prisma.$disconnect();
}));
