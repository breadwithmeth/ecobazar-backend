import { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export const createStore = async (req: Request, res: Response) => {
  const { name, address } = req.body;
  if (!name || !address) return res.status(400).json({ message: 'Имя и адрес обязательны' });
  const store = await prisma.store.create({ data: { name, address } });
  res.status(201).json(store);
};

export const getStores = async (_req: Request, res: Response) => {
  const stores = await prisma.store.findMany();
  res.json(stores);
};
