"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.validateQuery = exports.validateParams = exports.validateBody = void 0;
const errorHandler_1 = require("./errorHandler");
const validateBody = (schema) => {
    return (req, res, next) => {
        try {
            const result = schema.safeParse(req.body);
            if (!result.success) {
                const errors = result.error.issues.map((err) => `${err.path.join('.')}: ${err.message}`);
                throw new errorHandler_1.AppError(`Ошибки валидации тела запроса: ${errors.join(', ')}`, 400);
            }
            req.body = result.data;
            next();
        }
        catch (error) {
            next(error);
        }
    };
};
exports.validateBody = validateBody;
const validateParams = (schema) => {
    return (req, res, next) => {
        try {
            const result = schema.safeParse(req.params);
            if (!result.success) {
                const errors = result.error.issues.map((err) => `${err.path.join('.')}: ${err.message}`);
                throw new errorHandler_1.AppError(`Ошибки валидации параметров: ${errors.join(', ')}`, 400);
            }
            // Типизированно обновляем параметры
            req.validatedParams = result.data;
            next();
        }
        catch (error) {
            next(error);
        }
    };
};
exports.validateParams = validateParams;
const validateQuery = (schema) => {
    return (req, res, next) => {
        try {
            const result = schema.safeParse(req.query);
            if (!result.success) {
                const errors = result.error.issues.map((err) => `${err.path.join('.')}: ${err.message}`);
                throw new errorHandler_1.AppError(`Ошибки валидации query параметров: ${errors.join(', ')}`, 400);
            }
            // Типизированно обновляем query
            req.validatedQuery = result.data;
            next();
        }
        catch (error) {
            next(error);
        }
    };
};
exports.validateQuery = validateQuery;
