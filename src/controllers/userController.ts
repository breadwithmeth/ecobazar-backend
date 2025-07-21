// PATCH /api/user/me — обновить имя и номер телефона
import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

export const updateMe = async (req: AuthRequest, res: Response) => {
  if (!req.user) return res.status(401).json({ message: 'Не авторизован' });
  const { name, phone_number } = req.body;
  if (!name && !phone_number) return res.status(400).json({ message: 'Нужно передать name или phone_number' });
  const updated = await prisma.user.update({
    where: { id: req.user.id },
    data: {
      ...(name !== undefined ? { name } : {}),
      ...(phone_number !== undefined ? { phone_number } : {})
    }
  });
  res.json({ id: updated.id, telegram_user_id: updated.telegram_user_id, role: updated.role, phone_number: updated.phone_number, name: updated.name });
};
import { Request, Response } from 'express';
import { AuthRequest } from '../middlewares/auth';

export const getMe = (req: AuthRequest, res: Response) => {
  if (!req.user) return res.status(401).json({ message: 'Не авторизован' });
  const { id, telegram_user_id, role, phone_number, name } = req.user as any;
  res.json({ id, telegram_user_id, role, phone_number, name });
};
