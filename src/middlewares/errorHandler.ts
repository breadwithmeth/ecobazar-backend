import { Request, Response, NextFunction } from 'express';
import { PrismaClientKnownRequestError, PrismaClientValidationError } from '@prisma/client/runtime/library';

interface ErrorResponse {
  message: string;
  status: number;
  stack?: string;
  details?: any;
}

export class AppError extends Error {
  public readonly statusCode: number;
  public readonly isOperational: boolean;

  constructor(message: string, statusCode: number = 500, isOperational: boolean = true) {
    super(message);
    this.statusCode = statusCode;
    this.isOperational = isOperational;

    Error.captureStackTrace(this, this.constructor);
  }
}

export const errorHandler = (
  error: Error,
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  let errorResponse: ErrorResponse = {
    message: 'Внутренняя ошибка сервера',
    status: 500
  };

  // AppError - наши кастомные ошибки
  if (error instanceof AppError) {
    errorResponse = {
      message: error.message,
      status: error.statusCode
    };
  }
  // Ошибки Prisma
  else if (error instanceof PrismaClientKnownRequestError) {
    errorResponse = handlePrismaError(error);
  }
  else if (error instanceof PrismaClientValidationError) {
    errorResponse = {
      message: 'Ошибка валидации данных',
      status: 400,
      details: error.message
    };
  }
  // JWT ошибки
  else if (error.name === 'JsonWebTokenError') {
    errorResponse = {
      message: 'Неверный токен',
      status: 401
    };
  }
  else if (error.name === 'TokenExpiredError') {
    errorResponse = {
      message: 'Токен истек',
      status: 401
    };
  }
  // Общие ошибки
  else if (error.message) {
    errorResponse.message = error.message;
  }

  // В режиме разработки добавляем stack trace
  if (process.env.NODE_ENV === 'development') {
    errorResponse.stack = error.stack;
  }

  // Логируем ошибку
  console.error(`Error ${errorResponse.status}: ${errorResponse.message}`, {
    url: req.url,
    method: req.method,
    ip: req.ip,
    userAgent: req.get('User-Agent'),
    stack: error.stack
  });

  res.status(errorResponse.status).json({
    error: {
      message: errorResponse.message,
      ...(errorResponse.details && { details: errorResponse.details }),
      ...(errorResponse.stack && { stack: errorResponse.stack })
    }
  });
};

function handlePrismaError(error: PrismaClientKnownRequestError): ErrorResponse {
  switch (error.code) {
    case 'P2002':
      return {
        message: 'Запись с такими данными уже существует',
        status: 409
      };
    case 'P2025':
      return {
        message: 'Запись не найдена',
        status: 404
      };
    case 'P2003':
      return {
        message: 'Ошибка внешнего ключа',
        status: 400
      };
    case 'P2014':
      return {
        message: 'Нарушение связи между данными',
        status: 400
      };
    default:
      return {
        message: 'Ошибка базы данных',
        status: 500
      };
  }
}

export const notFoundHandler = (req: Request, res: Response): void => {
  res.status(404).json({
    error: {
      message: `Маршрут ${req.originalUrl} не найден`
    }
  });
};
