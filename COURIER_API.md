# API для Курьеров - EcoBazar Backend

Полная документация API для курьеров системы доставки EcoBazar.

---

## 🔑 Аутентификация

Все эндпоинты требуют JWT токен с ролью `COURIER` в заголовке:
```
Authorization: Bearer <your_jwt_token>
```

### Получение токена курьера

**POST /api/auth**

```bash
curl -X POST https://eco-b-6sgyz.ondigitalocean.app/api/auth \
  -H "Content-Type: application/json" \
  -d '{"telegram_user_id": "your_courier_id"}'
```

**Ответ:**
```json
{
  "success": true,
  "data": {
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "user": {
      "id": 1,
      "telegram_user_id": "courier123",
      "role": "COURIER",
      "name": "Петр Петров",
      "phone_number": "+7900123456"
    }
  },
  "message": "Успешная авторизация"
}
```

---

## 📦 Управление заказами

### GET /api/courier/orders
Получить список назначенных вам заказов.

**Параметры запроса:**
- `page` (number): Номер страницы (по умолчанию: 1)
- `limit` (number): Количество на странице (1-50, по умолчанию: 10)
- `status` (string): Фильтр по статусу заказа

**Доступные статусы для фильтрации:**
- `NEW` - Новый заказ
- `WAITING_PAYMENT` - Ожидание оплаты
- `PREPARING` - Подготовка заказа
- `DELIVERING` - Доставляется (ваши текущие заказы)
- `DELIVERED` - Доставлен
- `CANCELLED` - Отменен

**Пример запроса:**
```bash
curl -X GET "https://eco-b-6sgyz.ondigitalocean.app/api/courier/orders?page=1&limit=5&status=DELIVERING" \
  -H "Authorization: Bearer YOUR_COURIER_TOKEN"
```

**Ответ (200):**
```json
{
  "success": true,
  "data": {
    "orders": [
      {
        "id": 1,
        "address": "ул. Примерная, 123, кв. 45",
        "user": {
          "id": 1,
          "name": "Иван Иванов",
          "phone_number": "+1234567890"
        },
        "items": [
          {
            "id": 1,
            "quantity": 3,
            "price": 199.99,
            "product": {
              "id": 1,
              "name": "Органические яблоки",
              "image": "https://example.com/apple.jpg"
            }
          },
          {
            "id": 2,
            "quantity": 2,
            "price": 89.99,
            "product": {
              "id": 2,
              "name": "Био молоко",
              "image": "https://example.com/milk.jpg"
            }
          }
        ],
        "statuses": [
          {
            "id": 5,
            "status": "DELIVERING",
            "createdAt": "2025-07-22T10:30:00.000Z"
          }
        ],
        "currentStatus": "DELIVERING",
        "totalAmount": 779.95,
        "createdAt": "2025-07-22T10:00:00.000Z",
        "updatedAt": "2025-07-22T10:30:00.000Z"
      }
    ],
    "meta": {
      "page": 1,
      "limit": 5,
      "total": 8,
      "totalPages": 2
    }
  }
}
```

---

### PUT /api/courier/orders/:id/status
Отметить заказ как доставленный.

**⚠️ Важно:** Курьер может изменить статус только на `DELIVERED` и только для заказов в статусе `DELIVERING`.

**Параметры:**
- `id` (number): ID заказа

**Тело запроса:**
```json
{
  "status": "DELIVERED"
}
```

**Пример запроса:**
```bash
curl -X PUT https://eco-b-6sgyz.ondigitalocean.app/api/courier/orders/1/status \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_COURIER_TOKEN" \
  -d '{"status": "DELIVERED"}'
```

**Ответ (200):**
```json
{
  "success": true,
  "data": {
    "id": 1,
    "address": "ул. Примерная, 123, кв. 45",
    "user": {
      "id": 1,
      "name": "Иван Иванов",
      "phone_number": "+1234567890"
    },
    "items": [
      {
        "id": 1,
        "quantity": 3,
        "price": 199.99,
        "product": {
          "id": 1,
          "name": "Органические яблоки",
          "image": "https://example.com/apple.jpg"
        }
      }
    ],
    "statuses": [
      {
        "id": 6,
        "status": "DELIVERED",
        "createdAt": "2025-07-22T11:00:00.000Z"
      },
      {
        "id": 5,
        "status": "DELIVERING",
        "createdAt": "2025-07-22T10:30:00.000Z"
      }
    ],
    "currentStatus": "DELIVERED",
    "totalAmount": 779.95,
    "updatedAt": "2025-07-22T11:00:00.000Z"
  },
  "message": "Заказ отмечен как доставленный"
}
```

**Ошибки:**
- `403` - Заказ не назначен вам
- `400` - Можно отметить доставленным только заказ в статусе "DELIVERING"
- `404` - Заказ не найден

---

## 📊 Статистика работы

### GET /api/courier/stats
Получить вашу статистику работы.

**Пример запроса:**
```bash
curl -X GET https://eco-b-6sgyz.ondigitalocean.app/api/courier/stats \
  -H "Authorization: Bearer YOUR_COURIER_TOKEN"
```

**Ответ (200):**
```json
{
  "success": true,
  "data": {
    "totalOrders": 30,
    "deliveredOrders": 25,
    "activeOrders": 3,
    "monthlyDelivered": 12,
    "deliveryRate": 83.3,
    "efficiency": "Хорошая"
  }
}
```

**Расшифровка статистики:**
- `totalOrders` - Общее количество назначенных заказов
- `deliveredOrders` - Количество успешно доставленных заказов
- `activeOrders` - Текущие активные заказы (в процессе доставки)
- `monthlyDelivered` - Доставлено за текущий месяц
- `deliveryRate` - Процент успешных доставок
- `efficiency` - Оценка эффективности работы

---

## 🔄 Жизненный цикл заказа

### Последовательность статусов:
1. **NEW** → Новый заказ создан покупателем
2. **WAITING_PAYMENT** → Заказ ожидает оплаты
3. **PREPARING** → Заказ подготавливается
4. **DELIVERING** → **Заказ назначен вам** (можете работать с ним)
5. **DELIVERED** → **Вы отметили заказ как доставленный**
6. **CANCELLED** → Заказ отменен

### Ваши действия:
- **Получать заказы** со статусом `DELIVERING`
- **Отмечать как доставленные** только заказы в статусе `DELIVERING`

---

## 🚫 Ограничения безопасности

### ✅ Что вы можете делать:
- Просматривать только назначенные вам заказы
- Изменять статус только на `DELIVERED`
- Просматривать свою статистику

### ❌ Что вы НЕ можете делать:
- Видеть заказы других курьеров
- Назначать себе заказы (это делает администратор)
- Изменять статусы на другие значения
- Видеть список других курьеров
- Получать административную информацию

---

## 📱 Примеры использования

### Получение текущих заказов для доставки:
```bash
curl -X GET "https://eco-b-6sgyz.ondigitalocean.app/api/courier/orders?status=DELIVERING" \
  -H "Authorization: Bearer YOUR_COURIER_TOKEN"
```

### Отметка заказа как доставленного:
```bash
curl -X PUT https://eco-b-6sgyz.ondigitalocean.app/api/courier/orders/15/status \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_COURIER_TOKEN" \
  -d '{"status": "DELIVERED"}'
```

### Проверка своей статистики:
```bash
curl -X GET https://eco-b-6sgyz.ondigitalocean.app/api/courier/stats \
  -H "Authorization: Bearer YOUR_COURIER_TOKEN"
```

---

## 🔧 JavaScript/TypeScript код

### Класс для работы с API курьера:
```javascript
class CourierAPI {
  constructor(token) {
    this.token = token;
    this.baseURL = 'https://eco-b-6sgyz.ondigitalocean.app/api';
  }

  // Получить заказы
  async getOrders(page = 1, limit = 10, status = null) {
    const params = new URLSearchParams({ 
      page: page.toString(), 
      limit: limit.toString() 
    });
    if (status) params.append('status', status);
    
    const response = await fetch(`${this.baseURL}/courier/orders?${params}`, {
      headers: {
        'Authorization': `Bearer ${this.token}`
      }
    });
    return response.json();
  }

  // Отметить заказ как доставленный
  async markAsDelivered(orderId) {
    const response = await fetch(`${this.baseURL}/courier/orders/${orderId}/status`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.token}`
      },
      body: JSON.stringify({ status: 'DELIVERED' })
    });
    return response.json();
  }

  // Получить статистику
  async getStats() {
    const response = await fetch(`${this.baseURL}/courier/stats`, {
      headers: {
        'Authorization': `Bearer ${this.token}`
      }
    });
    return response.json();
  }

  // Получить активные заказы (готовые к доставке)
  async getActiveOrders() {
    return this.getOrders(1, 50, 'DELIVERING');
  }
}

// Использование:
const courier = new CourierAPI('your_jwt_token');

// Получить активные заказы
const activeOrders = await courier.getActiveOrders();

// Отметить заказ как доставленный
const result = await courier.markAsDelivered(15);

// Получить статистику
const stats = await courier.getStats();
```

---

## 📝 Коды ошибок

### 401 Unauthorized
```json
{
  "success": false,
  "error": {
    "code": "UNAUTHORIZED",
    "message": "Требуется авторизация"
  }
}
```

### 403 Forbidden
```json
{
  "success": false,
  "error": {
    "code": "FORBIDDEN",
    "message": "Требуется роль курьера"
  }
}
```

### 404 Not Found
```json
{
  "success": false,
  "error": {
    "code": "NOT_FOUND",
    "message": "Заказ не найден"
  }
}
```

### 400 Bad Request
```json
{
  "success": false,
  "error": {
    "code": "INVALID_STATUS",
    "message": "Можно отметить доставленным только заказ в статусе DELIVERING"
  }
}
```

---

## 🆘 Поддержка

Если у вас возникли проблемы с API:

1. **Проверьте токен** - убедитесь, что используете актуальный JWT токен
2. **Проверьте роль** - ваша роль должна быть `COURIER`
3. **Проверьте статус заказа** - можно изменить только заказы в статусе `DELIVERING`
4. **Обратитесь к администратору** - если заказы не назначаются

---

**Документация создана:** 23 июля 2025 г.  
**Версия API:** 2.0  
**Для ролей:** COURIER
