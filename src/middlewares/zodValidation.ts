import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { AppError } from './errorHandler';

export const validateBody = <T>(schema: z.ZodSchema<T>) => {
  return (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = schema.safeParse(req.body);
      if (!result.success) {
        const errors = result.error.issues.map((err: any) => 
          `${err.path.join('.')}: ${err.message}`
        );
        throw new AppError(`Ошибки валидации тела запроса: ${errors.join(', ')}`, 400);
      }
      // Сохраняем в оба места для совместимости
      req.body = result.data;
      (req as any).validatedBody = result.data;
      next();
    } catch (error) {
      next(error);
    }
  };
};

export const validateParams = <T>(schema: z.ZodSchema<T>) => {
  return (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = schema.safeParse(req.params);
      if (!result.success) {
        const errors = result.error.issues.map((err: any) => 
          `${err.path.join('.')}: ${err.message}`
        );
        throw new AppError(`Ошибки валидации параметров: ${errors.join(', ')}`, 400);
      }
      // Типизированно обновляем параметры
      (req as any).validatedParams = result.data;
      next();
    } catch (error) {
      next(error);
    }
  };
};

export const validateQuery = <T>(schema: z.ZodSchema<T>) => {
  return (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = schema.safeParse(req.query);
      if (!result.success) {
        const errors = result.error.issues.map((err: any) => 
          `${err.path.join('.')}: ${err.message}`
        );
        throw new AppError(`Ошибки валидации query параметров: ${errors.join(', ')}`, 400);
      }
      // Типизированно обновляем query
      (req as any).validatedQuery = result.data;
      next();
    } catch (error) {
      next(error);
    }
  };
};
