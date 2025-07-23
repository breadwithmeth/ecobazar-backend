# Тестирование функционала курьера

## Тестовые сценарии

### 1. Создание пользователя с ролью курьера
```sql
-- Выполнить в базе данных для создания тестового курьера
INSERT INTO "User" (telegram_user_id, role, phone) 
VALUES ('courier123', 'COURIER', '+7900123456');
```

### 2. Аутентификация курьера
```bash
curl -X POST http://localhost:4000/api/auth \
  -H "Content-Type: application/json" \
  -d '{"telegram_user_id": "courier123"}'
```

### 3. Получение заказов курьера
```bash
curl -X GET "http://localhost:4000/api/courier/orders?page=1&limit=5" \
  -H "Authorization: Bearer COURIER_TOKEN"
```

### 4. Назначение курьера на заказ (от админа)
```bash
curl -X POST http://localhost:4000/api/courier/assign \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer ADMIN_TOKEN" \
  -d '{"courierId": "1", "orderId": "1"}'
```

### 5. Обновление статуса заказа курьером
```bash
curl -X PUT http://localhost:4000/api/courier/orders/1/status \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer COURIER_TOKEN" \
  -d '{"status": "DELIVERED"}'
```

### 6. Получение списка курьеров (от админа)
```bash
curl -X GET "http://localhost:4000/api/courier/list?page=1&limit=10" \
  -H "Authorization: Bearer ADMIN_TOKEN"
```

### 7. Статистика курьера (от админа)
```bash
curl -X GET http://localhost:4000/api/courier/1/stats \
  -H "Authorization: Bearer ADMIN_TOKEN"
```

## Проверка безопасности

1. **Курьер может видеть только свои заказы** - GET /api/courier/orders
2. **Курьер может менять статус только на DELIVERED** - PUT /api/courier/orders/:id/status
3. **Курьер не может назначать заказы** - POST /api/courier/assign (403)
4. **Курьер не может видеть других курьеров** - GET /api/courier/list (403)
5. **Только админ может назначать курьеров** - POST /api/courier/assign
6. **Только админ может видеть статистику** - GET /api/courier/:id/stats

## Workflow заказа с курьером

1. **NEW** → Новый заказ создан покупателем
2. **WAITING_PAYMENT** → Заказ ожидает оплаты
3. **PREPARING** → Заказ подготавливается
4. **DELIVERING** → Админ назначил курьера (автоматически меняется статус)
5. **DELIVERED** → Курьер отметил заказ как доставленный
6. **CANCELLED** → Заказ отменен

## Примеры данных

### Структура заказа для курьера:
```json
{
  "id": 1,
  "totalPrice": 599.97,
  "address": "ул. Примерная, 123, кв. 45",
  "status": "DELIVERING",
  "user": {
    "phone": "+1234567890"
  },
  "items": [
    {
      "quantity": 3,
      "price": 199.99,
      "product": {
        "name": "Органические яблоки"
      }
    }
  ],
  "courier": {
    "id": 1,
    "phone": "+7900123456"
  }
}
```

### Права доступа:
- **CUSTOMER**: Создание заказов, просмотр своих заказов
- **ADMIN**: Полный доступ, назначение курьеров, управление заказами
- **COURIER**: Просмотр назначенных заказов, обновление статуса на "доставлен"
