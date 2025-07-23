import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding database...');

  // Создаем тестового пользователя
  const testUser = await prisma.user.upsert({
    where: { telegram_user_id: '123' },
    update: {},
    create: {
      telegram_user_id: '123',
      name: 'Тестовый пользователь',
      role: 'ADMIN'
    }
  });

//   // Создаем курьера
//   const courier = await prisma.user.upsert({
//     where: { telegram_user_id: '987654321' },
//     update: {},
//     create: {
//       telegram_user_id: '987654321',
//       name: 'Тестовый курьер',
//       role: 'COURIER'
//     }
//   });

//   // Создаем категорию
//   const category = await prisma.category.upsert({
//     where: { id: 1 },
//     update: {},
//     create: {
//       name: 'Продукты питания'
//     }
//   });

//   // Создаем магазин
//   const store = await prisma.store.upsert({
//     where: { id: 1 },
//     update: {},
//     create: {
//       name: 'EcoBazar',
//       address: 'ул. Тестовая, 1'
//     }
//   });

//   // Создаем товар
//   const product = await prisma.product.upsert({
//     where: { id: 1 },
//     update: {},
//     create: {
//       name: 'Органические яблоки',
//       price: 500,
//       storeId: store.id,
//       categoryId: category.id
//     }
//   });

//   // Создаем stock для товара
//   await prisma.stockMovement.create({
//     data: {
//       productId: product.id,
//       quantity: 100,
//       type: 'INCOME',
//       comment: 'Начальный запас',
//       adminId: testUser.id
//     }
//   });

//   console.log('✅ Seeding completed!');
//   console.log(`📱 Test user: ${testUser.telegram_user_id}`);
//   console.log(`🚚 Courier: ${courier.telegram_user_id}`);
//   console.log(`🏪 Store: ${store.name}`);
//   console.log(`🍎 Product: ${product.name}`);
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
