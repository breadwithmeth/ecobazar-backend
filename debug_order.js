const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function debugOrder() {
  try {
    console.log('🔍 Проверяем заказ #22...\n');
    
    const order = await prisma.order.findUnique({
      where: { id: 22 },
      include: {
        items: {
          include: {
            product: {
              include: {
                store: {
                  include: {
                    owner: true
                  }
                }
              }
            },
            storeConfirmation: true
          }
        }
      }
    });

    if (!order) {
      console.log('❌ Заказ #22 не найден');
      return;
    }

    console.log('📦 Заказ #22:');
    console.log(`  Адрес: ${order.address}`);
    console.log(`  Товаров: ${order.items.length}\n`);

    console.log('🛍️ Товары:');
    for (const item of order.items) {
      console.log(`  - ${item.product.name}`);
      console.log(`    Количество: ${item.quantity}`);
      console.log(`    Цена: ${item.price}`);
      console.log(`    Магазин: ${item.product.store.name} (ID: ${item.product.store.id})`);
      console.log(`    Владелец магазина: ${item.product.store.owner?.name || 'Нет'} (Telegram ID: ${item.product.store.owner?.telegram_user_id || 'Нет'})`);
      console.log(`    Подтверждение: ${item.storeConfirmation ? `ID ${item.storeConfirmation.id}, статус ${item.storeConfirmation.status}` : 'НЕТ'}`);
      console.log('');
    }

    // Группируем по магазинам
    console.log('🏪 Группировка по магазинам:');
    const storeGroups = new Map();
    
    for (const item of order.items) {
      const storeId = item.product.store.id;
      if (!storeGroups.has(storeId)) {
        storeGroups.set(storeId, []);
      }
      storeGroups.get(storeId).push(item);
    }

    for (const [storeId, items] of storeGroups.entries()) {
      const store = items[0].product.store;
      console.log(`  Магазин: ${store.name} (ID: ${storeId})`);
      console.log(`  Владелец: ${store.owner?.name || 'Нет'} (Telegram: ${store.owner?.telegram_user_id || 'Нет'})`);
      console.log(`  Товаров: ${items.length}`);
      for (const item of items) {
        console.log(`    - ${item.product.name} x${item.quantity}`);
      }
      console.log('');
    }

  } catch (error) {
    console.error('❌ Ошибка:', error);
  } finally {
    await prisma.$disconnect();
  }
}

debugOrder();
