import { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export const getCategories = async (_req: Request, res: Response) => {
  const categories = await prisma.category.findMany({ select: { id: true, name: true } });
  res.json(categories);
};

export const createCategory = async (req: Request, res: Response) => {
  const { name } = req.body;
  if (!name) return res.status(400).json({ message: 'name обязателен' });
  const category = await prisma.category.create({ data: { name } });
  res.status(201).json(category);
};

export const updateCategory = async (req: Request, res: Response) => {
  const { id } = req.params;
  const { name } = req.body;
  if (!name) return res.status(400).json({ message: 'name обязателен' });
  const category = await prisma.category.update({ where: { id: Number(id) }, data: { name } });
  res.json(category);
};

export const deleteCategory = async (req: Request, res: Response) => {
  const { id } = req.params;
  await prisma.category.delete({ where: { id: Number(id) } });
  res.json({ success: true });
};
