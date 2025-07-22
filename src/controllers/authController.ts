import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import prisma from '../lib/prisma';
import { AppError } from '../middlewares/errorHandler';
import { ApiResponseUtil } from '../utils/apiResponse';
import { securityLogger } from '../middlewares/logger';

interface TokenPayload {
  userId: number;
  role: string;
}

const generateToken = (user: { id: number; role: string }): string => {
  const payload: TokenPayload = {
    userId: user.id,
    role: user.role
  };
  
  return jwt.sign(payload, process.env.JWT_SECRET as string, { 
    expiresIn: '7d',
    issuer: 'ecobazar-backend',
    audience: 'ecobazar-users'
  });
};

export const registerOrLogin = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { telegram_user_id } = req.body;
    
    if (!telegram_user_id) {
      throw new AppError('telegram_user_id обязателен', 400);
    }
    
    // Проверяем формат telegram_user_id
    if (typeof telegram_user_id !== 'string' && typeof telegram_user_id !== 'number') {
      throw new AppError('telegram_user_id должен быть строкой или числом', 400);
    }
    
    const telegramIdStr = String(telegram_user_id);
    
    // Ищем существующего пользователя
    let user = await prisma.user.findUnique({ 
      where: { telegram_user_id: telegramIdStr },
      select: {
        id: true,
        telegram_user_id: true,
        role: true,
        name: true,
        phone_number: true
      }
    });
    
    if (user) {
      // Логин существующего пользователя
      const token = generateToken(user);
      
      console.log(`✅ User login: ${user.id} (${user.telegram_user_id})`);
      
      ApiResponseUtil.success(res, {
        token,
        user: {
          id: user.id,
          telegram_user_id: user.telegram_user_id,
          role: user.role,
          name: user.name,
          phone_number: user.phone_number
        }
      }, 'Успешная авторизация');
    } else {
      // Регистрация нового пользователя
      user = await prisma.user.create({ 
        data: { telegram_user_id: telegramIdStr },
        select: {
          id: true,
          telegram_user_id: true,
          role: true,
          name: true,
          phone_number: true
        }
      });
      
      const token = generateToken(user);
      
      console.log(`🆕 User registered: ${user.id} (${user.telegram_user_id})`);
      
      ApiResponseUtil.created(res, {
        token,
        user: {
          id: user.id,
          telegram_user_id: user.telegram_user_id,
          role: user.role,
          name: user.name,
          phone_number: user.phone_number
        }
      }, 'Пользователь успешно зарегистрирован');
    }
  } catch (error) {
    if (error instanceof AppError) {
      securityLogger.logFailedAuth(req, error.message);
    }
    next(error);
  }
};
