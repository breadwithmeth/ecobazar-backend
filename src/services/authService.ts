import jwt from 'jsonwebtoken';
import prisma from '../lib/prisma';
import { AppError } from '../middlewares/errorHandler';
import { CreateUserRequest, UpdateUserRequest, AuthResponse } from '../types';

interface TokenPayload {
  userId: number;
  role: string;
}

export class AuthService {
  private generateToken(user: { id: number; role: string }): string {
    const payload: TokenPayload = {
      userId: user.id,
      role: user.role
    };
    
    return jwt.sign(payload, process.env.JWT_SECRET as string, { 
      expiresIn: '7d',
      issuer: 'ecobazar-backend',
      audience: 'ecobazar-users'
    });
  }

  async registerOrLogin(telegram_user_id: string): Promise<AuthResponse> {
    if (!telegram_user_id) {
      throw new AppError('telegram_user_id обязателен', 400);
    }

    // Проверяем формат telegram_user_id
    if (typeof telegram_user_id !== 'string' && typeof telegram_user_id !== 'number') {
      throw new AppError('telegram_user_id должен быть строкой или числом', 400);
    }
    
    const telegramIdStr = String(telegram_user_id);
    
    // Проверяем формат
    if (!/^\d+$/.test(telegramIdStr)) {
      throw new AppError('telegram_user_id должен содержать только цифры', 400);
    }
    
    if (telegramIdStr.length < 3 || telegramIdStr.length > 15) {
      throw new AppError('telegram_user_id должен содержать от 5 до 15 цифр', 400);
    }
    
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
      const token = this.generateToken(user);
      
      return {
        token,
        user: {
          id: user.id,
          telegram_user_id: user.telegram_user_id,
          role: user.role,
          name: user.name,
          phone_number: user.phone_number
        }
      };
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
      
      const token = this.generateToken(user);
      
      return {
        token,
        user: {
          id: user.id,
          telegram_user_id: user.telegram_user_id,
          role: user.role,
          name: user.name,
          phone_number: user.phone_number
        }
      };
    }
  }

  async verifyToken(token: string) {
    try {
      const payload = jwt.verify(token, process.env.JWT_SECRET as string) as TokenPayload;
      
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
        throw new AppError('Пользователь не найден', 401);
      }
      
      // Проверяем, что роль в токене соответствует роли в БД
      if (user.role !== payload.role) {
        throw new AppError('Недействительный токен', 401);
      }
      
      return user;
    } catch (error) {
      if (error instanceof jwt.JsonWebTokenError) {
        throw new AppError('Недействительный токен', 401);
      } else if (error instanceof jwt.TokenExpiredError) {
        throw new AppError('Токен истек', 401);
      }
      throw error;
    }
  }

  async updateUser(userId: number, data: UpdateUserRequest) {
    const user = await prisma.user.findUnique({
      where: { id: userId }
    });

    if (!user) {
      throw new AppError('Пользователь не найден', 404);
    }

    if (!data.name && !data.phone_number) {
      throw new AppError('Нужно передать name или phone_number', 400);
    }

    // Валидация номера телефона
    if (data.phone_number && !/^\+?[1-9]\d{1,14}$/.test(data.phone_number)) {
      throw new AppError('Неверный формат номера телефона', 400);
    }

    const updateData: any = {};
    if (data.name !== undefined) updateData.name = data.name.trim();
    if (data.phone_number !== undefined) updateData.phone_number = data.phone_number;

    return prisma.user.update({
      where: { id: userId },
      data: updateData,
      select: {
        id: true,
        telegram_user_id: true,
        role: true,
        phone_number: true,
        name: true
      }
    });
  }

  async getUserById(userId: number) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        telegram_user_id: true,
        role: true,
        phone_number: true,
        name: true
      }
    });

    if (!user) {
      throw new AppError('Пользователь не найден', 404);
    }

    return user;
  }
}
