import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { PrismaClient } from '@prisma/client';
import type { User } from '../../generated/prisma';

const prisma = new PrismaClient();

export interface AuthRequest extends Request {
  user?: User;
}


export const authenticate = async (req: AuthRequest, res: Response, next: NextFunction) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ message: 'Нет токена' });
  }
  const token = authHeader.split(' ')[1];
  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET as string) as { userId: number };
    const user = await prisma.user.findUnique({ where: { id: payload.userId }, include: { } });
    if (!user) return res.status(401).json({ message: 'Пользователь не найден' });
    // Remove password before attaching to req.user for security
    const { password, ...userWithoutPassword } = user as any;
    req.user = userWithoutPassword as User;
    next();
  } catch (e) {
    return res.status(401).json({ message: 'Неверный токен' });
  }
};

export const isAdmin = (req: AuthRequest, res: Response, next: NextFunction) => {
  if (req.user?.role !== 'ADMIN') {
    return res.status(403).json({ message: 'Требуется роль администратора' });
  }
  next();
};
