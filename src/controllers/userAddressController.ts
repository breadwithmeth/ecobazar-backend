export const getAddresses = async (req: AuthRequest, res: Response) => {
  if (!req.user) return res.status(401).json({ message: 'Не авторизован' });
  const addresses = await prisma.userAddress.findMany({
    where: { userId: req.user.id },
    select: { id: true, address: true },
  });
  res.json(addresses);
};
import { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { AuthRequest } from '../middlewares/auth';

const prisma = new PrismaClient();

export const addAddress = async (req: AuthRequest, res: Response) => {
  const { address } = req.body;
  if (!address) return res.status(400).json({ message: 'address обязателен' });
  if (!req.user) return res.status(401).json({ message: 'Не авторизован' });
  const newAddress = await prisma.userAddress.create({
    data: {
      userId: req.user.id,
      address,
    },
  });
  res.status(201).json(newAddress);
};

export const deleteAddress = async (req: AuthRequest, res: Response) => {
  const { id } = req.params;
  if (!req.user) return res.status(401).json({ message: 'Не авторизован' });
  const address = await prisma.userAddress.findUnique({ where: { id: Number(id) } });
  if (!address || address.userId !== req.user.id) {
    return res.status(404).json({ message: 'Адрес не найден или не принадлежит пользователю' });
  }
  await prisma.userAddress.delete({ where: { id: Number(id) } });
  res.json({ success: true });
};
