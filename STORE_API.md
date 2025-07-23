# API для Магазинов - EcoBazar Backend

Полная документация API для продавцов и управления магазинами в системе EcoBazar.

---

## 🔑 Аутентификация

Все защищенные эндпоинты требуют JWT токен с соответствующей ролью в заголовке:
```
Authorization: Bearer <your_jwt_token>
```

### Роли пользователей
- `ADMIN` - Администратор (может управлять всеми магазинами)
- `SELLER` - Продавец (может управлять только назначенным магазином)
- `CUSTOMER` - Покупатель (может просматривать магазины)
- `COURIER` - Курьер (доставка заказов)

---

## 🏪 Общие эндпоинты магазинов

### GET /api/stores
Получить список всех магазинов (публичный доступ).

**Параметры запроса:**
- `page` (number): Номер страницы (по умолчанию: 1)
- `limit` (number): Количество на странице (1-100, по умолчанию: 10)
- `sortBy` (string): Поле сортировки (по умолчанию: id)
- `sortOrder` (string): Порядок сортировки: asc/desc (по умолчанию: asc)
- `search` (string): Поиск по названию или адресу
- `ownerId` (number): Фильтр по владельцу

**Пример запроса:**
```bash
curl -X GET "https://eco-b-6sgyz.ondigitalocean.app/api/stores?page=1&limit=10&search=эко"
```

**Ответ (200):**
```json
{
  "success": true,
  "data": {
    "data": [
      {
        "id": 1,
        "name": "ЭкоМагазин Центр",
        "address": "ул. Главная, 123",
        "owner": {
          "id": 2,
          "name": "Мария Петрова",
          "telegram_user_id": "seller123",
          "phone_number": "+7900123456",
          "role": "SELLER"
        },
        "products": [
          {
            "id": 1,
            "name": "Органические яблоки",
            "price": 199.99,
            "image": "https://example.com/apple.jpg"
          }
        ],
        "_count": {
          "products": 25
        }
      }
    ],
    "meta": {
      "page": 1,
      "limit": 10,
      "total": 3,
      "totalPages": 1
    }
  }
}
```

---

### GET /api/stores/:id
Получить информацию о конкретном магазине (публичный доступ).

**Параметры:**
- `id` (number): ID магазина

**Пример запроса:**
```bash
curl -X GET https://eco-b-6sgyz.ondigitalocean.app/api/stores/1
```

**Ответ (200):**
```json
{
  "success": true,
  "data": {
    "id": 1,
    "name": "ЭкоМагазин Центр",
    "address": "ул. Главная, 123",
    "owner": {
      "id": 2,
      "name": "Мария Петрова",
      "telegram_user_id": "seller123",
      "phone_number": "+7900123456",
      "role": "SELLER"
    },
    "products": [
      {
        "id": 1,
        "name": "Органические яблоки",
        "price": 199.99,
        "image": "https://example.com/apple.jpg"
      }
    ]
  }
}
```

---

## 👤 Эндпоинты для продавцов (SELLER)

### GET /api/stores/my/store
Получить информацию о своем магазине.

**Авторизация:** Требуется роль SELLER

**Пример запроса:**
```bash
curl -X GET https://eco-b-6sgyz.ondigitalocean.app/api/stores/my/store \
  -H "Authorization: Bearer YOUR_SELLER_TOKEN"
```

**Ответ (200):**
```json
{
  "success": true,
  "data": {
    "id": 1,
    "name": "ЭкоМагазин Центр",
    "address": "ул. Главная, 123",
    "owner": {
      "id": 2,
      "name": "Мария Петрова",
      "telegram_user_id": "seller123",
      "phone_number": "+7900123456",
      "role": "SELLER"
    },
    "products": [
      {
        "id": 1,
        "name": "Органические яблоки",
        "price": 199.99,
        "image": "https://example.com/apple.jpg"
      }
    ]
  }
}
```

**Ошибки:**
- `403` - Требуется роль продавца
- `404` - У вас нет назначенного магазина

---

### GET /api/stores/my/orders
Получить заказы для своего магазина.

**Авторизация:** Требуется роль SELLER

**Параметры запроса:**
- `page` (number): Номер страницы (по умолчанию: 1)
- `limit` (number): Количество на странице (1-100, по умолчанию: 10)
- `sortBy` (string): Поле сортировки
- `sortOrder` (string): Порядок сортировки: asc/desc

**Пример запроса:**
```bash
curl -X GET "https://eco-b-6sgyz.ondigitalocean.app/api/stores/my/orders?page=1&limit=10" \
  -H "Authorization: Bearer YOUR_SELLER_TOKEN"
```

**Ответ (200):**
```json
{
  "success": true,
  "data": {
    "data": [
      {
        "id": 1,
        "address": "ул. Примерная, 123, кв. 45",
        "createdAt": "2025-07-23T10:00:00.000Z",
        "user": {
          "id": 3,
          "name": "Иван Иванов",
          "telegram_user_id": "customer123",
          "phone_number": "+7900987654"
        },
        "items": [
          {
            "id": 1,
            "quantity": 3,
            "price": 199.99,
            "product": {
              "id": 1,
              "name": "Органические яблоки",
              "price": 199.99,
              "image": "https://example.com/apple.jpg"
            }
          }
        ],
        "statuses": [
          {
            "id": 1,
            "status": "PENDING",
            "createdAt": "2025-07-23T10:00:00.000Z"
          }
        ],
        "currentStatus": "PENDING",
        "storeTotal": 599.97,
        "storeItemsCount": 1
      }
    ],
    "meta": {
      "page": 1,
      "limit": 10,
      "total": 5,
      "totalPages": 1
    }
  }
}
```

---

### GET /api/stores/my/order-items
Получить элементы заказов для подтверждения.

**Авторизация:** Требуется роль SELLER

**Параметры запроса:**
- `page` (number): Номер страницы (по умолчанию: 1)
- `limit` (number): Количество на странице (1-100, по умолчанию: 10)
- `status` (string): Фильтр по статусу подтверждения
- `orderId` (number): Фильтр по ID заказа

**Доступные статусы подтверждения:**
- `PENDING` - Ожидает подтверждения (по умолчанию для новых заказов)
- `CONFIRMED` - Подтверждено (товар есть в наличии в полном объеме)
- `PARTIAL` - Частично подтверждено (товар есть, но в меньшем количестве)
- `REJECTED` - Отклонено (товара нет в наличии)

**Пример запроса:**
```bash
curl -X GET "https://eco-b-6sgyz.ondigitalocean.app/api/stores/my/order-items?status=PENDING&page=1&limit=10" \
  -H "Authorization: Bearer YOUR_SELLER_TOKEN"
```

**Ответ (200):**
```json
{
  "success": true,
  "data": {
    "data": [
      {
        "id": 1,
        "quantity": 3,
        "price": 199.99,
        "order": {
          "id": 1,
          "address": "ул. Примерная, 123, кв. 45",
          "createdAt": "2025-07-23T10:00:00.000Z",
          "user": {
            "id": 3,
            "name": "Иван Иванов",
            "telegram_user_id": "customer123",
            "phone_number": "+7900987654"
          },
          "statuses": [
            {
              "status": "PENDING",
              "createdAt": "2025-07-23T10:00:00.000Z"
            }
          ]
        },
        "product": {
          "id": 1,
          "name": "Органические яблоки",
          "price": 199.99,
          "image": "https://example.com/apple.jpg"
        },
        "confirmationStatus": "PENDING",
        "confirmedQuantity": null,
        "confirmationNotes": null,
        "confirmedAt": null,
        "confirmedBy": null,
        "currentOrderStatus": "NEW"
      }
    ],
    "meta": {
      "page": 1,
      "limit": 10,
      "total": 8,
      "totalPages": 1
    }
  }
}
```

---

### PUT /api/stores/my/order-items/:orderItemId/confirm
Подтвердить наличие товара в заказе.

**Авторизация:** Требуется роль SELLER

**Параметры:**
- `orderItemId` (number): ID элемента заказа

**Тело запроса:**
```json
{
  "status": "CONFIRMED",
  "confirmedQuantity": 3,
  "notes": "Товар в наличии, готов к отправке"
}
```

**Параметры тела запроса:**
- `status` (string): Статус подтверждения (CONFIRMED, PARTIAL, REJECTED)
- `confirmedQuantity` (number): Подтвержденное количество (опционально)
- `notes` (string): Примечания (опционально, до 500 символов)

**Правила валидации:**
- При `CONFIRMED`: `confirmedQuantity` должно равняться заказанному количеству
- При `PARTIAL`: `confirmedQuantity` должно быть больше 0 и меньше заказанного
- При `REJECTED`: `confirmedQuantity` автоматически устанавливается в 0

**Пример запроса:**
```bash
curl -X PUT https://eco-b-6sgyz.ondigitalocean.app/api/stores/my/order-items/1/confirm \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_SELLER_TOKEN" \
  -d '{
    "status": "CONFIRMED",
    "confirmedQuantity": 3,
    "notes": "Товар в наличии"
  }'
```

**Ответ (200):**
```json
{
  "success": true,
  "data": {
    "id": 1,
    "orderItemId": 1,
    "storeId": 1,
    "status": "CONFIRMED",
    "confirmedQuantity": 3,
    "notes": "Товар в наличии",
    "confirmedAt": "2025-07-23T12:00:00.000Z",
    "confirmedById": 2,
    "orderItem": {
      "id": 1,
      "quantity": 3,
      "price": 199.99,
      "product": {
        "id": 1,
        "name": "Органические яблоки",
        "price": 199.99,
        "image": "https://example.com/apple.jpg"
      },
      "order": {
        "id": 1,
        "address": "ул. Примерная, 123, кв. 45",
        "user": {
          "id": 3,
          "name": "Иван Иванов",
          "telegram_user_id": "customer123",
          "phone_number": "+7900987654"
        }
      }
    },
    "confirmedBy": {
      "id": 2,
      "name": "Мария Петрова",
      "telegram_user_id": "seller123"
    }
  },
  "message": "Подтверждение товара обновлено"
}
```

**Ошибки:**
- `404` - Элемент заказа не найден или не принадлежит вашему магазину
- `400` - Нельзя подтверждать товары для завершенного заказа
- `400` - Неверное количество для выбранного статуса

---

### GET /api/stores/my/stats
Получить статистику подтверждений для своего магазина.

**Авторизация:** Требуется роль SELLER

**Пример запроса:**
```bash
curl -X GET https://eco-b-6sgyz.ondigitalocean.app/api/stores/my/stats \
  -H "Authorization: Bearer YOUR_SELLER_TOKEN"
```

**Ответ (200):**
```json
{
  "success": true,
  "data": {
    "totalItems": 45,
    "pendingItems": 8,
    "confirmedItems": 32,
    "partialItems": 3,
    "rejectedItems": 2,
    "todayConfirmations": 12,
    "confirmationRate": 78
  }
}
```

**Расшифровка статистики:**
- `totalItems` - Общее количество элементов заказов для магазина
- `pendingItems` - Количество элементов, ожидающих подтверждения
- `confirmedItems` - Количество полностью подтвержденных элементов
- `partialItems` - Количество частично подтвержденных элементов
- `rejectedItems` - Количество отклоненных элементов
- `todayConfirmations` - Количество подтверждений за сегодня
- `confirmationRate` - Процент подтвержденных элементов от общего количества

---

## 🔧 Эндпоинты для администраторов (ADMIN)

### POST /api/stores
Создать новый магазин.

**Авторизация:** Требуется роль ADMIN

**Тело запроса:**
```json
{
  "name": "ЭкоМагазин Север",
  "address": "пр. Северный, 45",
  "ownerId": 5
}
```

**Параметры:**
- `name` (string): Название магазина (обязательно, 1-200 символов)
- `address` (string): Адрес магазина (обязательно, 1-300 символов)
- `ownerId` (number): ID пользователя-владельца (опционально)

**Пример запроса:**
```bash
curl -X POST https://eco-b-6sgyz.ondigitalocean.app/api/stores \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer ADMIN_TOKEN" \
  -d '{
    "name": "ЭкоМагазин Север",
    "address": "пр. Северный, 45",
    "ownerId": 5
  }'
```

**Ответ (201):**
```json
{
  "success": true,
  "data": {
    "id": 2,
    "name": "ЭкоМагазин Север",
    "address": "пр. Северный, 45",
    "ownerId": 5,
    "owner": {
      "id": 5,
      "name": "Петр Сидоров",
      "telegram_user_id": "seller456",
      "phone_number": "+7900111222",
      "role": "SELLER"
    }
  },
  "message": "Магазин успешно создан"
}
```

---

### PUT /api/stores/:id
Обновить информацию о магазине.

**Авторизация:** Требуется роль ADMIN или владелец магазина

**Параметры:**
- `id` (number): ID магазина

**Тело запроса:**
```json
{
  "name": "ЭкоМагазин Север Обновленный",
  "address": "пр. Северный, 47"
}
```

**Пример запроса:**
```bash
curl -X PUT https://eco-b-6sgyz.ondigitalocean.app/api/stores/2 \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer ADMIN_TOKEN" \
  -d '{
    "name": "ЭкоМагазин Север Обновленный",
    "address": "пр. Северный, 47"
  }'
```

**Ответ (200):**
```json
{
  "success": true,
  "data": {
    "id": 2,
    "name": "ЭкоМагазин Север Обновленный",
    "address": "пр. Северный, 47",
    "ownerId": 5,
    "owner": {
      "id": 5,
      "name": "Петр Сидоров",
      "telegram_user_id": "seller456",
      "phone_number": "+7900111222",
      "role": "SELLER"
    }
  },
  "message": "Магазин успешно обновлен"
}
```

---

### POST /api/stores/:id/assign-owner
Назначить владельца магазина.

**Авторизация:** Требуется роль ADMIN

**Параметры:**
- `id` (number): ID магазина

**Тело запроса:**
```json
{
  "ownerId": 7
}
```

**Пример запроса:**
```bash
curl -X POST https://eco-b-6sgyz.ondigitalocean.app/api/stores/2/assign-owner \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer ADMIN_TOKEN" \
  -d '{"ownerId": 7}'
```

**Ответ (200):**
```json
{
  "success": true,
  "data": {
    "id": 2,
    "name": "ЭкоМагазин Север",
    "address": "пр. Северный, 45",
    "ownerId": 7,
    "owner": {
      "id": 7,
      "name": "Анна Козлова",
      "telegram_user_id": "seller789",
      "phone_number": "+7900333444",
      "role": "SELLER"
    }
  },
  "message": "Владелец магазина назначен"
}
```

---

### DELETE /api/stores/:id
Удалить магазин.

**Авторизация:** Требуется роль ADMIN

**Параметры:**
- `id` (number): ID магазина

**Пример запроса:**
```bash
curl -X DELETE https://eco-b-6sgyz.ondigitalocean.app/api/stores/2 \
  -H "Authorization: Bearer ADMIN_TOKEN"
```

**Ответ (200):**
```json
{
  "success": true,
  "data": null,
  "message": "Магазин удален"
}
```

---

## 🔄 Жизненный цикл заказа с подтверждением магазина

### Последовательность обработки заказа:

1. **PENDING** → Покупатель создал заказ
2. **Подтверждение магазинами** → Продавцы подтверждают наличие товаров:
   - `CONFIRMED` - Товар есть в полном объеме
   - `PARTIAL` - Товар есть частично
   - `REJECTED` - Товара нет
3. **CONFIRMED** → Админ подтверждает заказ (после подтверждения магазинами)
4. **PREPARING** → Заказ собирается
5. **READY** → Заказ готов к выдаче
6. **DELIVERING** → Заказ передан курьеру
7. **DELIVERED** → Заказ доставлен

### Ответственность продавца:
- **Своевременно подтверждать** наличие товаров
- **Указывать точное количество** при частичном подтверждении
- **Оставлять пояснения** при отклонении или частичном подтверждении

---

## 🚫 Ограничения безопасности

### ✅ Что может SELLER:
- Просматривать только свой назначенный магазин
- Видеть заказы только с товарами из своего магазина
- Подтверждать только товары из своего магазина
- Обновлять информацию своего магазина

### ❌ Что НЕ может SELLER:
- Видеть информацию других магазинов
- Подтверждать товары других магазинов
- Назначать себе другой магазин
- Создавать или удалять магазины
- Видеть полную статистику системы

### ✅ Что может ADMIN:
- Создавать, обновлять и удалять магазины
- Назначать владельцев магазинов
- Просматривать все магазины и заказы
- Изменять роли пользователей

---

## 📱 Примеры использования

### Подтверждение товара полностью:
```bash
curl -X PUT https://eco-b-6sgyz.ondigitalocean.app/api/stores/my/order-items/15/confirm \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer SELLER_TOKEN" \
  -d '{
    "status": "CONFIRMED",
    "confirmedQuantity": 5,
    "notes": "Товар в наличии, готов к отправке"
  }'
```

### Частичное подтверждение:
```bash
curl -X PUT https://eco-b-6sgyz.ondigitalocean.app/api/stores/my/order-items/16/confirm \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer SELLER_TOKEN" \
  -d '{
    "status": "PARTIAL",
    "confirmedQuantity": 3,
    "notes": "В наличии только 3 из 5 заказанных единиц"
  }'
```

### Отклонение товара:
```bash
curl -X PUT https://eco-b-6sgyz.ondigitalocean.app/api/stores/my/order-items/17/confirm \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer SELLER_TOKEN" \
  -d '{
    "status": "REJECTED",
    "notes": "Товар временно отсутствует на складе"
  }'
```

### Получение ожидающих подтверждения товаров:
```bash
curl -X GET "https://eco-b-6sgyz.ondigitalocean.app/api/stores/my/order-items?status=PENDING" \
  -H "Authorization: Bearer SELLER_TOKEN"
```

---

## 🔧 JavaScript/TypeScript код

### Класс для работы с Store API:
```javascript
class StoreAPI {
  constructor(token) {
    this.token = token;
    this.baseURL = 'https://eco-b-6sgyz.ondigitalocean.app/api/stores';
  }

  // Получить свой магазин
  async getMyStore() {
    const response = await fetch(`${this.baseURL}/my/store`, {
      headers: {
        'Authorization': `Bearer ${this.token}`
      }
    });
    return response.json();
  }

  // Получить элементы заказов для подтверждения
  async getOrderItems(page = 1, limit = 10, status = null) {
    const params = new URLSearchParams({ 
      page: page.toString(), 
      limit: limit.toString() 
    });
    if (status) params.append('status', status);
    
    const response = await fetch(`${this.baseURL}/my/order-items?${params}`, {
      headers: {
        'Authorization': `Bearer ${this.token}`
      }
    });
    return response.json();
  }

  // Подтвердить элемент заказа
  async confirmOrderItem(orderItemId, confirmationData) {
    const response = await fetch(`${this.baseURL}/my/order-items/${orderItemId}/confirm`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.token}`
      },
      body: JSON.stringify(confirmationData)
    });
    return response.json();
  }

  // Получить статистику
  async getStats() {
    const response = await fetch(`${this.baseURL}/my/stats`, {
      headers: {
        'Authorization': `Bearer ${this.token}`
      }
    });
    return response.json();
  }

  // Получить ожидающие подтверждения товары
  async getPendingItems() {
    return this.getOrderItems(1, 50, 'PENDING');
  }
}

// Использование:
const store = new StoreAPI('your_seller_token');

// Получить ожидающие подтверждения товары
const pendingItems = await store.getPendingItems();

// Подтвердить товар полностью
const confirmation = await store.confirmOrderItem(15, {
  status: 'CONFIRMED',
  confirmedQuantity: 5,
  notes: 'Товар в наличии'
});

// Получить статистику
const stats = await store.getStats();
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
    "message": "Требуется роль продавца"
  }
}
```

### 404 Not Found
```json
{
  "success": false,
  "error": {
    "code": "NOT_FOUND",
    "message": "У вас нет назначенного магазина"
  }
}
```

### 400 Bad Request
```json
{
  "success": false,
  "error": {
    "code": "INVALID_STATUS",
    "message": "При полном подтверждении количество должно совпадать с заказанным"
  }
}
```

---

## 🆘 Поддержка

Если у вас возникли проблемы с API:

1. **Проверьте токен** - убедитесь, что используете актуальный JWT токен
2. **Проверьте роль** - ваша роль должна быть `SELLER` для управления магазином
3. **Проверьте назначение** - убедитесь, что вам назначен магазин
4. **Обратитесь к администратору** - если магазин не назначен или есть проблемы с доступом

---

**Документация создана:** 23 июля 2025 г.  
**Версия API:** 2.0  
**Для ролей:** ADMIN, SELLER, CUSTOMER
