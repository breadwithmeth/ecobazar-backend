import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  await prisma.user.update({
    where: { telegram_user_id: '111111111' },
    data: { role: 'ADMIN' }
  });
  
  console.log('✅ Пользователь обновлен до роли ADMIN');
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
