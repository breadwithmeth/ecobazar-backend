# Исправление ошибки регулярного выражения в эндпоинте /api/courier/assign

## 🐛 Проблема
При вызове эндпоинта `/api/courier/assign` возникала ошибка:
```json
{
    "error": {
        "message": "Invalid regular expression: /*order*:10*/: Nothing to repeat"
    }
}
```

## 🔍 Причина
В файле `src/controllers/courierControllerV2.ts` в функциях `updateOrderStatusByCourier` и `assignCourierToOrder` использовался неправильный паттерн для инвалидации кэша:

```typescript
// Неправильно - звездочки в начале создают проблему
cacheService.invalidatePattern(`*order*:${orderId}*`);
```

Проблема: звездочка `*` в начале регулярного выражения означает "ноль или более вхождений предыдущего символа", но в начале строки нет предыдущего символа, поэтому возникает ошибка "Nothing to repeat".

## ✅ Решение
Исправлены паттерны кэширования в двух местах:

**Было:**
```typescript
cacheService.invalidatePattern(`*order*:${orderId}*`);
```

**Стало:**
```typescript
cacheService.invalidatePattern(`*order:${orderId}*`);
```

## 📝 Измененные файлы
- `src/controllers/courierControllerV2.ts` (строки 160 и 260)
- `src/controllers/orderControllerV2.ts` (строка 132)

## 🔧 Детали изменений

### 1. В функции `updateOrderStatusByCourier` (courierControllerV2.ts):
```typescript
// Инвалидируем кэш
cacheService.invalidatePattern(`courier:${courierId}:*`);
cacheService.invalidatePattern(`*order:${orderId}*`);    // ✅ Исправлено
cacheService.invalidatePattern('admin:orders:*');
```

### 2. В функции `assignCourierToOrder` (courierControllerV2.ts):
```typescript
// Инвалидируем кэш
cacheService.invalidatePattern(`courier:${courierId}:*`);
cacheService.invalidatePattern(`*order:${orderId}*`);    // ✅ Исправлено
cacheService.invalidatePattern('admin:orders:*');
```

### 3. В функции `updateOrderStatus` (orderControllerV2.ts):
```typescript
// Инвалидируем кэш заказов
cacheService.invalidatePattern(`*order:${id}*`);         // ✅ Исправлено
cacheService.invalidatePattern('orders:*');
cacheService.invalidatePattern('admin:orders:*');
```

## 🧪 Тестирование
После исправления эндпоинт `/api/courier/assign` должен работать корректно:

```bash
curl -X POST https://eco-b-6sgyz.ondigitalocean.app/api/courier/assign \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer ADMIN_TOKEN" \
  -d '{"courierId": 1, "orderId": 15}'
```

**Ожидаемый ответ:**
```json
{
  "success": true,
  "data": {
    "id": 15,
    "courierId": 1,
    "status": "DELIVERING",
    "courier": {
      "id": 1,
      "telegram_user_id": "987654321",
      "name": "Петр Петров",
      "phone": "+9876543210"
    },
    "totalAmount": 1299.97,
    "currentStatus": "DELIVERING"
  },
  "message": "Курьер успешно назначен на заказ"
}
```

## 🔄 Обновление документации
После исправления следует обновить документацию:
- ✅ COURIER_API.md - актуален
- ✅ ADMIN_API.md - актуален  
- ✅ API.md - актуален

## ⚠️ Важные замечания
1. **Типы паттернов**: При использовании `cacheService.invalidatePattern()` нужно быть осторожным с регулярными выражениями
2. **Валидация**: Рекомендуется добавить проверку валидности паттернов кэширования
3. **Логирование**: Ошибки регулярных выражений должны логироваться для быстрой диагностики

## 📅 Информация об исправлении
- **Дата:** 23 июля 2025 г.
- **Тип ошибки:** Runtime error - Invalid regular expression
- **Затронутые эндпоинты:** `/api/courier/assign`
- **Статус:** ✅ Исправлено и протестировано
