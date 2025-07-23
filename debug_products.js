const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function listProductsAndStores() {
  try {
    console.log('🏪 Список товаров и магазинов:\n');
    
    const products = await prisma.product.findMany({
      include: {
        store: {
          include: {
            owner: true
          }
        }
      },
      orderBy: { id: 'asc' }
    });

    const storeGroups = new Map();
    
    for (const product of products) {
      const storeId = product.store.id;
      if (!storeGroups.has(storeId)) {
        storeGroups.set(storeId, {
          store: product.store,
          products: []
        });
      }
      storeGroups.get(storeId).products.push(product);
    }

    for (const [storeId, data] of storeGroups.entries()) {
      const { store, products } = data;
      console.log(`🏪 ${store.name} (ID: ${storeId})`);
      console.log(`   Владелец: ${store.owner?.name || 'Нет'} (Telegram: ${store.owner?.telegram_user_id || 'Нет'})`);
      console.log(`   Товары:`);
      for (const product of products) {
        console.log(`     - ID ${product.id}: ${product.name} - ${product.price} ₸`);
      }
      console.log('');
    }

    // Также проверим остатки
    console.log('📦 Остатки на складе:');
    for (const product of products) {
      const movements = await prisma.stockMovement.findMany({
        where: { productId: product.id },
        select: { quantity: true, type: true }
      });

      const stock = movements.reduce((sum, movement) => {
        return movement.type === 'INCOME' 
          ? sum + movement.quantity 
          : sum - movement.quantity;
      }, 0);

      console.log(`   ${product.name}: ${stock} шт.`);
    }

  } catch (error) {
    console.error('❌ Ошибка:', error);
  } finally {
    await prisma.$disconnect();
  }
}

listProductsAndStores();
