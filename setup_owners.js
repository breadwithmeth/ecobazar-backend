const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function setupStoreOwners() {
  try {
    console.log('🏪 Настраиваем владельцев магазинов...\n');
    
    // Создаем тестовых пользователей-продавцов
    const seller2 = await prisma.user.create({
      data: {
        telegram_user_id: '347115155',
        name: 'Сергей2',
        role: 'SELLER'
      }
    });

    const seller3 = await prisma.user.create({
      data: {
        telegram_user_id: '347115156',
        name: 'Сергей3',
        role: 'SELLER'
      }
    });

    // Назначаем владельцев магазинам
    await prisma.store.update({
      where: { id: 1 },
      data: { ownerId: seller2.id }
    });

    await prisma.store.update({
      where: { id: 2 },
      data: { ownerId: seller3.id }
    });

    console.log('✅ Владельцы назначены:');
    console.log(`   Магазин #1 -> ${seller2.name} (${seller2.telegram_user_id})`);
    console.log(`   Магазин #2 -> ${seller3.name} (${seller3.telegram_user_id})`);
    console.log('   Магазин #4 -> Сергей1 (347115154) - уже был назначен');

  } catch (error) {
    console.error('❌ Ошибка:', error);
  } finally {
    await prisma.$disconnect();
  }
}

setupStoreOwners();
