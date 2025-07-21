import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  // Создание пользователей
  const admin = await prisma.user.upsert({
    where: { telegram_user_id: '1001' },
    update: {},
    create: {
      telegram_user_id: '1001',
      role: 'ADMIN',
    },
  });
  const customer = await prisma.user.upsert({
    where: { telegram_user_id: '2001' },
    update: {},
    create: {
      telegram_user_id: '2001',
      role: 'CUSTOMER',
    },
  });

  // Создание магазинов
  const stores = await Promise.all([
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
  const categories = await Promise.all(
    categoryNames.map((name) => prisma.category.create({ data: { name } }))
  );

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
    const product = await prisma.product.create({
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
  await prisma.stockMovement.createMany({
    data: products.map((product, idx) => ({
      productId: product.id,
      quantity: 20 + idx,
      type: 'INCOME',
      adminId: admin.id,
    })),
  });

  console.log('Данные успешно добавлены!');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
