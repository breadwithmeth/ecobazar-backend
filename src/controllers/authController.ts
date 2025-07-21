import { Request, Response } from 'express';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();


export const registerOrLogin = async (req: Request, res: Response) => {
  const { telegram_user_id } = req.body;
  if (!telegram_user_id) {
    return res.status(400).json({ message: 'telegram_user_id обязателен' });
  }
  let user = await prisma.user.findUnique({ where: { telegram_user_id: String(telegram_user_id) } });
  if (user) {
    // Логин по telegram_user_id
    const token = jwt.sign({ userId: user.id, role: user.role }, process.env.JWT_SECRET as string, { expiresIn: '7d' });
    return res.json({ token });
  } else {
    // Регистрация (role не передаётся, всегда CUSTOMER по умолчанию)
    user = await prisma.user.create({ data: { telegram_user_id: String(telegram_user_id) } });
    const token = jwt.sign({ userId: user.id, role: user.role }, process.env.JWT_SECRET as string, { expiresIn: '7d' });
    return res.status(201).json({ token });
  }
};
