import { prisma } from '../../src/prisma';

export async function resetDb() {
  await prisma.orderItem.deleteMany();
  await prisma.order.deleteMany();
  await prisma.variant.deleteMany();
  await prisma.product.deleteMany();
  await prisma.visit.deleteMany();
  await prisma.dropConfig.deleteMany();
  await prisma.siteContent.deleteMany();
  await prisma.pageDesign.deleteMany();
  await prisma.adminUser.deleteMany();
}
