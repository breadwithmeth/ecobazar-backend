import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  // Назначаем курьера на заказ
  await prisma.order.update({
    where: { id: 1 },
    data: { 
      courierId: 2 // ID курьера из seed
    }
  });
  
  console.log('✅ Курьер назначен на заказ #1');
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
