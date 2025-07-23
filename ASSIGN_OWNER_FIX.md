# Исправление ошибки назначения владельца магазина

## Проблема
При попытке назначить владельца магазина через `/api/stores/:id/assign-owner` возникала ошибка:
```json
{
    "error": {
        "message": "Cannot destructure property 'ownerId' of 'req.validatedBody' as it is undefined."
    }
}
```

## Причина
1. **Middleware `validateBody`** сохранял валидированные данные только в `req.body`, но контроллер пытался получить их из `req.validatedBody`
2. **Схема валидации** ожидала `number`, но JSON передает строки, что могло вызывать проблемы типизации

## Исправления

### 1. Обновлен zodValidation middleware
**Файл:** `src/middlewares/zodValidation.ts`

Добавлено сохранение в `req.validatedBody` для совместимости:
```typescript
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
```

### 2. Улучшена схема валидации
**Файл:** `src/validators/schemas.ts`

Теперь схема принимает как number, так и string:
```typescript
export const assignStoreOwnerSchema = z.object({
  ownerId: z.union([
    z.number(),
    z.string().transform(Number)
  ]).refine(val => val > 0, 'ID владельца должен быть положительным')
});
```

## Тестирование

### Назначение владельца магазина
```bash
curl -X POST https://eco-b-6sgyz.ondigitalocean.app/api/stores/4/assign-owner \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN" \
  -d '{"ownerId": 7}'
```

### Ожидаемый ответ
```json
{
  "success": true,
  "data": {
    "id": 4,
    "name": "Название магазина",
    "address": "Адрес магазина",
    "ownerId": 7,
    "owner": {
      "id": 7,
      "name": "Имя владельца",
      "telegram_user_id": "owner_telegram",
      "phone_number": "+7900123456",
      "role": "SELLER"
    }
  },
  "message": "Владелец магазина назначен"
}
```

## Дополнительные проверки

### 1. Убедитесь, что пользователь имеет роль SELLER
```bash
curl -X GET https://eco-b-6sgyz.ondigitalocean.app/api/users/7 \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN"
```

### 2. Если пользователь не SELLER, сначала назначьте роль
```bash
curl -X PUT https://eco-b-6sgyz.ondigitalocean.app/api/admin/users/7/role \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN" \
  -d '{"role": "SELLER"}'
```

### 3. Затем назначьте магазин
```bash
curl -X POST https://eco-b-6sgyz.ondigitalocean.app/api/stores/4/assign-owner \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN" \
  -d '{"ownerId": 7}'
```

## Статус
✅ **Исправлено:** Middleware zodValidation обновлен  
✅ **Исправлено:** Схема валидации улучшена  
✅ **Готово:** Система теперь корректно обрабатывает назначение владельцев

**Дата исправления:** 23 июля 2025 г.  
**Версия:** 2.0
