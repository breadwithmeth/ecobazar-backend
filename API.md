# API Documentation v2.0

Полная документация API для EcoBazar Backend с улучшениями безопасности, валидации и мониторинга.

## 🔑 Аутентификация

Все защищенные эндпоинты требуют JWT токен в заголовке:
```
Authorization: Bearer <your_jwt_token>
```

### Роли пользователей
- `CUSTOMER` - Обычный пользователь
- `ADMIN` - Администратор
- `COURIER` - Курьер для доставки заказов

---

## 🚀 Эндпоинты аутентификации

### POST /api/auth
Аутентификация пользователя через Telegram ID.

**Тело запроса:**
```json
{
  "telegram_user_id": "123456789"
}
```

**Ответ (200):**
```json
{
  "success": true,
  "data": {
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "user": {
      "id": 1,
      "telegram_user_id": "123456789",
      "role": "CUSTOMER",
      "phone": "+1234567890",
      "createdAt": "2025-01-21T10:00:00.000Z"
    }
  },
  "message": "Пользователь успешно аутентифицирован"
}
```

**Ошибки:**
- `400` - Неверный формат telegram_user_id
- `500` - Внутренняя ошибка сервера

---

## 📦 Эндпоинты продуктов

### GET /api/products
Получить список продуктов с пагинацией и фильтрацией.

**Параметры запроса:**
- `page` (number): Номер страницы (по умолчанию: 1)
- `limit` (number): Количество на странице (1-100, по умолчанию: 10)
- `search` (string): Поиск по названию
- `categoryId` (number): Фильтр по категории
- `storeId` (number): Фильтр по магазину
- `minPrice` (number): Минимальная цена
- `maxPrice` (number): Максимальная цена

**Ответ (200):**
```json
{
  "success": true,
  "data": {
    "products": [
      {
        "id": 1,
        "name": "Органические яблоки",
        "price": 199.99,
        "image": "https://example.com/apple.jpg",
        "store": {
          "id": 1,
          "name": "Эко Маркет",
          "location": "Москва"
        },
        "category": {
          "id": 1,
          "name": "Фрукты"
        },
        "stock": {
          "quantity": 50
        },
        "createdAt": "2025-01-21T10:00:00.000Z"
      }
    ],
    "pagination": {
      "total": 150,
      "page": 1,
      "limit": 10,
      "totalPages": 15,
      "hasNext": true,
      "hasPrev": false
    }
  }
}
```

### GET /api/products/all
Получить ВСЕ продукты сразу без пагинации (для клиентских приложений).

**Параметры запроса:**
- `search` (string): Поиск по названию
- `categoryId` (number): Фильтр по категории
- `storeId` (number): Фильтр по магазину
- `minPrice` (number): Минимальная цена
- `maxPrice` (number): Максимальная цена
- `sortBy` (string): Поле для сортировки (по умолчанию: id)
- `sortOrder` (string): Порядок сортировки: asc/desc (по умолчанию: asc)

**Ответ (200):**
```json
{
  "success": true,
  "data": {
    "products": [
      {
        "id": 1,
        "name": "Органические яблоки",
        "price": 199.99,
        "image": "https://example.com/apple.jpg",
        "store": {
          "id": 1,
          "name": "Эко Маркет",
          "location": "Москва"
        },
        "category": {
          "id": 1,
          "name": "Фрукты"
        },
        "stock": 50,
        "inStock": true,
        "createdAt": "2025-01-21T10:00:00.000Z"
      },
      {
        "id": 2,
        "name": "Био молоко",
        "price": 89.99,
        "image": "https://example.com/milk.jpg",
        "store": {
          "id": 1,
          "name": "Эко Маркет",
          "location": "Москва"
        },
        "category": {
          "id": 2,
          "name": "Молочные продукты"
        },
        "stock": 25,
        "inStock": true,
        "createdAt": "2025-01-21T11:00:00.000Z"
      }
    ],
    "total": 2
  }
}
```

### GET /api/products/:id
Получить продукт по ID.

**Параметры:**
- `id` (number): ID продукта

**Ответ (200):**
```json
{
  "success": true,
  "data": {
    "id": 1,
    "name": "Органические яблоки",
    "price": 199.99,
    "image": "https://example.com/apple.jpg",
    "description": "Сочные органические яблоки...",
    "store": {
      "id": 1,
      "name": "Эко Маркет",
      "location": "Москва",
      "description": "Лучшие эко продукты"
    },
    "category": {
      "id": 1,
      "name": "Фрукты"
    },
    "stock": {
      "quantity": 50
    },
    "createdAt": "2025-01-21T10:00:00.000Z",
    "updatedAt": "2025-01-21T10:00:00.000Z"
  }
}
```

**Ошибки:**
- `404` - Продукт не найден

### POST /api/products
Создать новый продукт (только для админов).

**Авторизация:** Требуется роль ADMIN

**Тело запроса:**
```json
{
  "name": "Новый товар",
  "price": 99.99,
  "storeId": 1,
  "categoryId": 1,
  "image": "https://example.com/image.jpg",
  "description": "Описание товара (опционально)"
}
```

**Ответ (201):**
```json
{
  "success": true,
  "data": {
    "id": 2,
    "name": "Новый товар",
    "price": 99.99,
    "storeId": 1,
    "categoryId": 1,
    "image": "https://example.com/image.jpg",
    "description": "Описание товара",
    "createdAt": "2025-01-21T10:00:00.000Z"
  },
  "message": "Продукт успешно создан"
}
```

### PUT /api/products/:id
Обновить продукт (только для админов).

**Авторизация:** Требуется роль ADMIN

### DELETE /api/products/:id
Удалить продукт (только для админов).

**Авторизация:** Требуется роль ADMIN

---

## 🛒 Эндпоинты заказов

### GET /api/orders
Получить заказы пользователя.

**Авторизация:** Требуется токен пользователя

**Параметры запроса:**
- `page` (number): Номер страницы (по умолчанию: 1)
- `limit` (number): Количество на странице (1-50, по умолчанию: 10)
- `status` (string): Фильтр по статусу

**Ответ (200):**
```json
{
  "success": true,
  "data": {
    "orders": [
      {
        "id": 1,
        "userId": 1,
        "totalPrice": 599.97,
        "address": "ул. Примерная, 123",
        "status": "PENDING",
        "items": [
          {
            "id": 1,
            "productId": 1,
            "quantity": 3,
            "price": 199.99,
            "product": {
              "id": 1,
              "name": "Органические яблоки",
              "image": "https://example.com/apple.jpg"
            }
          }
        ],
        "createdAt": "2025-01-21T10:00:00.000Z",
        "updatedAt": "2025-01-21T10:00:00.000Z"
      }
    ],
    "pagination": {
      "total": 5,
      "page": 1,
      "limit": 10,
      "totalPages": 1,
      "hasNext": false,
      "hasPrev": false
    }
  }
}
```

### POST /api/orders
Создать новый заказ.

**Авторизация:** Требуется токен пользователя

**Тело запроса:**
```json
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
  "address": "ул. Примерная, 123, кв. 45"
}
```

**Ответ (201):**
```json
{
  "success": true,
  "data": {
    "id": 2,
    "userId": 1,
    "totalPrice": 399.98,
    "address": "ул. Примерная, 123, кв. 45",
    "status": "PENDING",
    "items": [
      {
        "id": 2,
        "productId": 1,
        "quantity": 2,
        "price": 199.99
      }
    ],
    "createdAt": "2025-01-21T10:00:00.000Z"
  },
  "message": "Заказ успешно создан"
}
```

### GET /api/orders/:id
Получить заказ по ID.

**Авторизация:** Требуется токен пользователя (может просматривать только свои заказы) или админа

### GET /api/orders/admin/all
Получить все заказы (только для админов).

**Авторизация:** Требуется роль ADMIN

### PUT /api/orders/:id/status
Обновить статус заказа (только для админов).

**Авторизация:** Требуется роль ADMIN

**Тело запроса:**
```json
{
  "status": "CONFIRMED"
}
```

**Доступные статусы:**
- `PENDING` - В ожидании
- `CONFIRMED` - Подтвержден
- `PROCESSING` - В обработке
- `SHIPPED` - Отправлен
- `DELIVERED` - Доставлен
- `CANCELLED` - Отменен

---

## 📂 Эндпоинты категорий

### GET /api/categories
Получить все категории.

**Ответ (200):**
```json
{
  "success": true,
  "data": [
    {
      "id": 1,
      "name": "Фрукты",
      "createdAt": "2025-01-21T10:00:00.000Z",
      "_count": {
        "products": 25
      }
    }
  ]
}
```

### POST /api/categories
Создать категорию (только для админов).

**Авторизация:** Требуется роль ADMIN

**Тело запроса:**
```json
{
  "name": "Новая категория"
}
```

---

## 🏪 Эндпоинты магазинов

### GET /api/stores
Получить все магазины.

**Параметры запроса:**
- `page` (number): Номер страницы
- `limit` (number): Количество на странице
- `search` (string): Поиск по названию или локации

**Ответ (200):**
```json
{
  "success": true,
  "data": {
    "stores": [
      {
        "id": 1,
        "name": "Эко Маркет",
        "location": "Москва, ул. Зеленая, 123",
        "description": "Лучшие эко продукты",
        "createdAt": "2025-01-21T10:00:00.000Z",
        "_count": {
          "products": 45
        }
      }
    ],
    "pagination": {
      "total": 10,
      "page": 1,
      "limit": 10,
      "totalPages": 1,
      "hasNext": false,
      "hasPrev": false
    }
  }
}
```

### POST /api/stores
Создать магазин (только для админов).

**Авторизация:** Требуется роль ADMIN

---

## 📊 Эндпоинты склада

### GET /api/stock/:productId
Получить информацию о остатках товара.

**Параметры:**
- `productId` (number): ID продукта

**Ответ (200):**
```json
{
  "success": true,
  "data": {
    "productId": 1,
    "quantity": 50,
    "updatedAt": "2025-01-21T10:00:00.000Z",
    "product": {
      "id": 1,
      "name": "Органические яблоки"
    }
  }
}
```

### PUT /api/stock/:productId
Обновить остатки товара (только для админов).

**Авторизация:** Требуется роль ADMIN

**Тело запроса:**
```json
{
  "quantity": 100
}
```

---

## 🏠 Эндпоинты адресов пользователя

### GET /api/user/addresses
Получить адреса пользователя.

**Авторизация:** Требуется токен пользователя

**Ответ (200):**
```json
{
  "success": true,
  "data": [
    {
      "id": 1,
      "userId": 1,
      "address": "ул. Примерная, 123, кв. 45",
      "isDefault": true,
      "createdAt": "2025-01-21T10:00:00.000Z"
    }
  ]
}
```

### POST /api/user/addresses
Добавить адрес пользователя.

**Авторизация:** Требуется токен пользователя

**Тело запроса:**
```json
{
  "address": "ул. Новая, 456, кв. 78",
  "isDefault": false
}
```

### PUT /api/user/addresses/:id
Обновить адрес пользователя.

### DELETE /api/user/addresses/:id
Удалить адрес пользователя.

---

## 📈 Эндпоинты мониторинга

### GET /health
Проверка состояния сервиса.

**Ответ (200):**
```json
{
  "status": "healthy",
  "timestamp": "2025-01-21T10:00:00.000Z",
  "version": "2.0.0",
  "environment": "production",
  "uptime": 3600,
  "metrics": {
    "uptime": 3600,
    "memoryUsedMB": 128.5,
    "totalRequests": 10000,
    "errorRate": "0.2",
    "activeConnections": 25
  },
  "database": {
    "status": "connected",
    "responseTime": 15
  }
}
```

### GET /metrics
Получить детальные метрики (требует токен в продакшне).

**Авторизация:** В продакшне требуется токен метрик

**Ответ (200):**
```json
{
  "success": true,
  "data": {
    "uptime": 7200,
    "memoryUsage": {
      "used": 134217728,
      "total": 1073741824,
      "percentage": 12.5
    },
    "requests": {
      "total": 50000,
      "perMinute": 125.5,
      "byEndpoint": {
        "/api/products": 15000,
        "/api/orders": 8000,
        "/api/auth": 2000
      }
    },
    "errors": {
      "total": 125,
      "rate": "0.25",
      "byType": {
        "4xx": 100,
        "5xx": 25
      }
    },
    "responseTime": {
      "average": 87.5,
      "p95": 150,
      "p99": 250
    },
    "cache": {
      "hitRate": "85.2",
      "entries": 1250
    }
  }
}
```

### GET /security-stats
Статистика безопасности (только для админов).

**Авторизация:** Требуется админ токен

**Ответ (200):**
```json
{
  "success": true,
  "data": {
    "blockedIPs": [
      {
        "ip": "192.168.1.100",
        "reason": "Rate limit exceeded",
        "blockedAt": "2025-01-21T09:30:00.000Z",
        "attempts": 15
      }
    ],
    "suspiciousActivity": [
      {
        "ip": "10.0.0.50",
        "userAgent": "sqlmap/1.0",
        "endpoint": "/api/products",
        "timestamp": "2025-01-21T09:45:00.000Z",
        "reason": "Suspicious User-Agent"
      }
    ],
    "rateLimitViolations": {
      "last24h": 45,
      "lastHour": 8
    }
  }
}
```

---

## � Эндпоинты курьера

### GET /api/courier/orders
Получить назначенные заказы курьера.

**Авторизация:** Требуется роль COURIER

**Параметры запроса:**
- `page` (number): Номер страницы (по умолчанию: 1)
- `limit` (number): Количество на странице (1-50, по умолчанию: 10)
- `status` (string): Фильтр по статусу заказа

**Ответ (200):**
```json
{
  "success": true,
  "data": {
    "orders": [
      {
        "id": 1,
        "totalPrice": 599.97,
        "address": "ул. Примерная, 123, кв. 45",
        "status": "SHIPPED",
        "user": {
          "phone": "+1234567890"
        },
        "items": [
          {
            "id": 1,
            "quantity": 3,
            "price": 199.99,
            "product": {
              "name": "Органические яблоки",
              "image": "https://example.com/apple.jpg"
            }
          }
        ],
        "createdAt": "2025-01-21T10:00:00.000Z",
        "updatedAt": "2025-01-21T10:00:00.000Z"
      }
    ],
    "pagination": {
      "total": 15,
      "page": 1,
      "limit": 10,
      "totalPages": 2,
      "hasNext": true,
      "hasPrev": false
    }
  }
}
```

### PUT /api/courier/orders/:id/status
Обновить статус заказа на "доставлен" (только для курьеров).

**Авторизация:** Требуется роль COURIER (может обновлять только назначенные заказы)

**Параметры:**
- `id` (number): ID заказа

**Тело запроса:**
```json
{
  "status": "DELIVERED"
}
```

**Ответ (200):**
```json
{
  "success": true,
  "data": {
    "id": 1,
    "status": "DELIVERED",
    "updatedAt": "2025-01-21T10:30:00.000Z"
  },
  "message": "Статус заказа обновлен"
}
```

**Ошибки:**
- `403` - Заказ не назначен данному курьеру
- `400` - Невозможно изменить статус (неверный текущий статус)
- `404` - Заказ не найден

### POST /api/courier/assign
Назначить курьера на заказ (только для админов).

**Авторизация:** Требуется роль ADMIN

**Тело запроса:**
```json
{
  "courierId": "1",
  "orderId": "15"
}
```

**Ответ (200):**
```json
{
  "success": true,
  "data": {
    "id": 15,
    "courierId": 1,
    "status": "SHIPPED",
    "courier": {
      "id": 1,
      "telegram_user_id": "987654321",
      "phone": "+9876543210"
    },
    "updatedAt": "2025-01-21T10:15:00.000Z"
  },
  "message": "Курьер назначен на заказ"
}
```

**Ошибки:**
- `404` - Заказ или курьер не найден
- `400` - Заказ уже назначен другому курьеру
- `400` - Неверный статус заказа для назначения

### GET /api/courier/list
Получить список всех курьеров (только для админов).

**Авторизация:** Требуется роль ADMIN

**Параметры запроса:**
- `page` (number): Номер страницы (по умолчанию: 1)
- `limit` (number): Количество на странице (1-50, по умолчанию: 10)

**Ответ (200):**
```json
{
  "success": true,
  "data": {
    "couriers": [
      {
        "id": 1,
        "telegram_user_id": "987654321",
        "phone": "+9876543210",
        "createdAt": "2025-01-21T09:00:00.000Z",
        "_count": {
          "deliveredOrders": 25
        }
      }
    ],
    "pagination": {
      "total": 5,
      "page": 1,
      "limit": 10,
      "totalPages": 1,
      "hasNext": false,
      "hasPrev": false
    }
  }
}
```

### GET /api/courier/:id/stats
Получить статистику курьера (только для админов).

**Авторизация:** Требуется роль ADMIN

**Параметры:**
- `id` (number): ID курьера

**Ответ (200):**
```json
{
  "success": true,
  "data": {
    "courier": {
      "id": 1,
      "telegram_user_id": "987654321",
      "phone": "+9876543210"
    },
    "stats": {
      "totalDelivered": 25,
      "activeOrders": 3,
      "averageDeliveryTime": 45.5,
      "lastDelivery": "2025-01-21T09:30:00.000Z"
    }
  }
}
```

**Ошибки:**
- `404` - Курьер не найден

---

## �📝 Форматы ошибок

Все ошибки возвращаются в едином формате:

**4xx ошибки клиента:**
```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Ошибка валидации данных",
    "details": [
      {
        "field": "email",
        "message": "Неверный формат email"
      }
    ]
  },
  "timestamp": "2025-01-21T10:00:00.000Z"
}
```

**5xx ошибки сервера:**
```json
{
  "success": false,
  "error": {
    "code": "INTERNAL_ERROR",
    "message": "Внутренняя ошибка сервера",
    "requestId": "req_12345"
  },
  "timestamp": "2025-01-21T10:00:00.000Z"
}
```

---

## 🔒 Безопасность

### Rate Limiting
- **Обычные пользователи**: 1000 запросов за 15 минут
- **Админы**: 100 запросов за 15 минут
- **Автоблокировка**: После 5 нарушений rate limit

### Валидация
- Все входящие данные валидируются с помощью Zod схем
- Защита от SQL injection
- Валидация размера запросов (максимум 10MB)
- Проверка User-Agent на подозрительную активность

### Заголовки безопасности
- `X-Content-Type-Options: nosniff`
- `X-Frame-Options: DENY`
- `X-XSS-Protection: 1; mode=block`
- `Strict-Transport-Security: max-age=31536000`

---

## 📋 Статус коды

| Код | Описание |
|-----|----------|
| 200 | Успешный запрос |
| 201 | Ресурс создан |
| 400 | Неверный запрос |
| 401 | Не авторизован |
| 403 | Доступ запрещен |
| 404 | Ресурс не найден |
| 409 | Конфликт данных |
| 422 | Ошибка валидации |
| 429 | Превышен лимит запросов |
| 500 | Внутренняя ошибка сервера |

---

## 📚 Примеры использования

### JavaScript/TypeScript
```javascript
// Аутентификация
const authResponse = await fetch('/api/auth', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    telegram_user_id: '123456789'
  })
});

const { data } = await authResponse.json();
const token = data.token;

// Получение продуктов с пагинацией
const productsResponse = await fetch('/api/products?page=1&limit=20', {
  headers: {
    'Authorization': `Bearer ${token}`
  }
});

const products = await productsResponse.json();

// Получение ВСЕХ продуктов сразу (для клиентских приложений)
const allProductsResponse = await fetch('/api/products/all?categoryId=1&sortBy=name&sortOrder=asc');
const allProducts = await allProductsResponse.json();

console.log(`Получено ${allProducts.data.total} товаров`);
console.log(allProducts.data.products);

// Создание заказа
const orderResponse = await fetch('/api/orders', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`
  },
  body: JSON.stringify({
    items: [
      { productId: 1, quantity: 2 },
      { productId: 3, quantity: 1 }
    ],
    address: 'ул. Примерная, 123'
  })
});
```

### cURL
```bash
# Аутентификация
curl -X POST http://localhost:4000/api/auth \
  -H "Content-Type: application/json" \
  -d '{"telegram_user_id": "123456789"}'

# Получение продуктов с пагинацией
curl -X GET "http://localhost:4000/api/products?page=1&limit=10" \
  -H "Authorization: Bearer YOUR_TOKEN"

# Получение ВСЕХ продуктов сразу
curl -X GET "http://localhost:4000/api/products/all?categoryId=1&search=яблоки"

# Получение всех продуктов с сортировкой
curl -X GET "http://localhost:4000/api/products/all?sortBy=price&sortOrder=asc"

# Создание заказа
curl -X POST http://localhost:4000/api/orders \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{
    "items": [{"productId": 1, "quantity": 2}],
    "address": "ул. Примерная, 123"
  }'
```

---

## 🎯 Версионирование

API версия 2.0 с обратной совместимостью для основных эндпоинтов. Новые возможности:

- Улучшенная структура ответов с полем `success`
- Детальная информация об ошибках
- Расширенные метрики и мониторинг
- Улучшенная пагинация
- Кэширование ответов
- Усиленная безопасность

---

Документация обновлена: 21 января 2025 г.
