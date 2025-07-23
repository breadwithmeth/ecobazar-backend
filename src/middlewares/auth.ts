import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import type { User } from '@prisma/client';
import prisma from '../lib/prisma';
import { AppError } from './errorHandler';
import { securityLogger } from './logger';

export interface AuthRequest extends Request {
  user?: User;
}

export const authenticate = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      securityLogger.logFailedAuth(req, 'Missing or invalid authorization header');
      throw new AppError('Токен не предоставлен', 401);
    }
    
    const token = authHeader.split(' ')[1];
    
    if (!token) {
      securityLogger.logFailedAuth(req, 'Empty token');
      throw new AppError('Токен не предоставлен', 401);
    }
    
    // Проверяем JWT токен
    const payload = jwt.verify(token, process.env.JWT_SECRET as string) as { 
      userId: number; 
      role: string;
      iat?: number;
      exp?: number;
    };
    
    // Проверяем существование пользователя
    const user = await prisma.user.findUnique({ 
      where: { id: payload.userId },
      select: {
        id: true,
        telegram_user_id: true,
        phone_number: true,
        role: true,
        name: true
      }
    });
    
    if (!user) {
      securityLogger.logFailedAuth(req, `User not found: ${payload.userId}`);
      throw new AppError('Пользователь не найден', 401);
    }
    
    // Проверяем, что роль в токене соответствует роли в БД
    if (user.role !== payload.role) {
      securityLogger.logFailedAuth(req, `Role mismatch for user: ${payload.userId}`);
      throw new AppError('Недействительный токен', 401);
    }
    
    req.user = user;
    next();
  } catch (error) {
    if (error instanceof jwt.JsonWebTokenError) {
      securityLogger.logFailedAuth(req, `Invalid JWT: ${error.message}`);
      next(new AppError('Недействительный токен', 401));
    } else if (error instanceof jwt.TokenExpiredError) {
      securityLogger.logFailedAuth(req, 'Expired JWT');
      next(new AppError('Токен истек', 401));
    } else {
      next(error);
    }
  }
};

export const isAdmin = (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    if (!req.user) {
      throw new AppError('Пользователь не авторизован', 401);
    }
    
    if (req.user.role !== 'ADMIN') {
      securityLogger.logUnauthorizedAccess(req, 'Admin endpoint');
      throw new AppError('Требуется роль администратора', 403);
    }
    
    next();
  } catch (error) {
    next(error);
  }
};

export const isCourier = (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    if (!req.user) {
      throw new AppError('Пользователь не авторизован', 401);
    }
    
    if (req.user.role !== 'COURIER') {
      securityLogger.logUnauthorizedAccess(req, 'Courier endpoint');
      throw new AppError('Требуется роль курьера', 403);
    }
    
    next();
  } catch (error) {
    next(error);
  }
};

export const isSeller = (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    if (!req.user) {
      throw new AppError('Пользователь не авторизован', 401);
    }
    
    if (req.user.role !== 'SELLER') {
      securityLogger.logUnauthorizedAccess(req, 'Seller endpoint');
      throw new AppError('Требуется роль продавца', 403);
    }
    
    next();
  } catch (error) {
    next(error);
  }
};

export const isAdminOrCourier = (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    if (!req.user) {
      throw new AppError('Пользователь не авторизован', 401);
    }
    
    if (req.user.role !== 'ADMIN' && req.user.role !== 'COURIER') {
      securityLogger.logUnauthorizedAccess(req, 'Admin/Courier endpoint');
      throw new AppError('Требуется роль администратора или курьера', 403);
    }
    
    next();
  } catch (error) {
    next(error);
  }
};

export const isOwnerOrAdmin = (getUserId: (req: AuthRequest) => number) => {
  return (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      if (!req.user) {
        throw new AppError('Пользователь не авторизован', 401);
      }
      
      const resourceUserId = getUserId(req);
      
      if (req.user.role !== 'ADMIN' && req.user.id !== resourceUserId) {
        securityLogger.logUnauthorizedAccess(req, `Resource belonging to user ${resourceUserId}`);
        throw new AppError('Доступ запрещен', 403);
      }
      
      next();
    } catch (error) {
      next(error);
    }
  };
};
