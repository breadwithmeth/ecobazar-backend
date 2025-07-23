# Планирование доставки заказов

## Описание

Добавлена возможность выбора времени доставки при создании заказа:
- **ASAP** - доставить как можно быстрее (по умолчанию)
- **SCHEDULED** - доставить в определенную дату и время

## API Endpoints

### Создание заказа с немедленной доставкой

```bash
POST /api/orders
Content-Type: application/json
Authorization: Bearer YOUR_TOKEN

{
  "items": [
    {
      "productId": 1,
      "quantity": 2
    }
  ],
  "address": "ул. Пушкина, д. 10, кв. 15",
  "deliveryType": "ASAP"
}
```

### Создание заказа с запланированной доставкой

```bash
POST /api/orders
Content-Type: application/json
Authorization: Bearer YOUR_TOKEN

{
  "items": [
    {
      "productId": 1,
      "quantity": 2
    },
    {
      "productId": 3,
      "quantity": 1
    }
  ],
  "address": "ул. Ленина, д. 25, кв. 7",
  "deliveryType": "SCHEDULED",
  "scheduledDate": "2025-07-24T14:30:00.000Z"
}
```

## Валидация

### Типы доставки
- `ASAP` - как можно быстрее
- `SCHEDULED` - запланированная доставка

### Правила для запланированной доставки
- При выборе `SCHEDULED` поле `scheduledDate` обязательно
- Дата доставки должна быть минимум через 30 минут от текущего времени
- Максимальный срок планирования: 7 дней от текущего времени
- Формат даты: ISO 8601 (`YYYY-MM-DDTHH:mm:ss.sssZ`)

## Примеры ответов

### Успешное создание заказа с запланированной доставкой

```json
{
  "success": true,
  "data": {
    "id": 26,
    "userId": 6,
    "address": "ул. Ленина, д. 25, кв. 7",
    "deliveryType": "SCHEDULED",
    "scheduledDate": "2025-07-24T14:30:00.000Z",
    "createdAt": "2025-07-23T11:50:00.000Z",
    "items": [
      {
        "id": 92,
        "productId": 1,
        "quantity": 2,
        "price": 25,
        "product": {
          "id": 1,
          "name": "Хлеб",
          "image": null
        }
      }
    ],
    "totalAmount": 50
  },
  "message": "Заказ успешно создан"
}
```

### Получение заказа с информацией о доставке

```json
{
  "success": true,
  "data": {
    "id": 26,
    "userId": 6,
    "address": "ул. Ленина, д. 25, кв. 7",
    "deliveryType": "SCHEDULED",
    "scheduledDate": "2025-07-24T14:30:00.000Z",
    "createdAt": "2025-07-23T11:50:00.000Z",
    "items": [...],
    "statuses": [...],
    "totalAmount": 50,
    "currentStatus": "NEW",
    "itemsCount": 1
  }
}
```

## Ошибки валидации

### Отсутствие даты при запланированной доставке
```json
{
  "success": false,
  "error": {
    "message": "При выборе запланированной доставки необходимо указать дату и время",
    "details": {
      "field": "scheduledDate"
    }
  }
}
```

### Неверная дата доставки
```json
{
  "success": false,
  "error": {
    "message": "Дата доставки должна быть от 30 минут до 7 дней от текущего времени",
    "details": {
      "field": "scheduledDate"
    }
  }
}
```

## Схема базы данных

Добавлены новые поля в таблицу `Order`:

```sql
ALTER TABLE "Order" ADD COLUMN "deliveryType" "DeliveryType" NOT NULL DEFAULT 'ASAP';
ALTER TABLE "Order" ADD COLUMN "scheduledDate" TIMESTAMP(3);

CREATE TYPE "DeliveryType" AS ENUM ('ASAP', 'SCHEDULED');
```

## Использование в админ-панели

Администраторы могут видеть тип доставки и запланированное время в списке заказов:
- В списке заказов отображается `deliveryType` и `scheduledDate`
- При просмотре детального заказа видна полная информация о планировании доставки
- Курьеры получают информацию о времени доставки в уведомлениях
