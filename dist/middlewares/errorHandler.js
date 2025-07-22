"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.notFoundHandler = exports.errorHandler = exports.AppError = void 0;
const library_1 = require("@prisma/client/runtime/library");
class AppError extends Error {
    constructor(message, statusCode = 500, isOperational = true) {
        super(message);
        this.statusCode = statusCode;
        this.isOperational = isOperational;
        Error.captureStackTrace(this, this.constructor);
    }
}
exports.AppError = AppError;
const errorHandler = (error, req, res, next) => {
    let errorResponse = {
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
    else if (error instanceof library_1.PrismaClientKnownRequestError) {
        errorResponse = handlePrismaError(error);
    }
    else if (error instanceof library_1.PrismaClientValidationError) {
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
        error: Object.assign(Object.assign({ message: errorResponse.message }, (errorResponse.details && { details: errorResponse.details })), (errorResponse.stack && { stack: errorResponse.stack }))
    });
};
exports.errorHandler = errorHandler;
function handlePrismaError(error) {
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
const notFoundHandler = (req, res) => {
    res.status(404).json({
        error: {
            message: `Маршрут ${req.originalUrl} не найден`
        }
    });
};
exports.notFoundHandler = notFoundHandler;
