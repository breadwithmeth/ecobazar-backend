# API Эндпоинты для Администраторов

Полное описание всех административных эндпоинтов EcoBazar Backend API v2.0.

## 🔑 Требования для всех админских эндпоинтов

- ✅ **Аутентификация**: JWT токен в заголовке `Authorization: Bearer <token>`
- ✅ **Авторизация**: Роль пользователя должна быть `ADMIN`
- ✅ **Rate Limiting**: 200 запросов за 15 минут (специальный лимит для админов)
- ✅ **Безопасность**: Автоматическое логирование всех админских действий

---

## 📦 Управление продуктами

### POST /api/products
Создать новый продукт.

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

**Валидация:**
- `name`: обязательно, строка 1-255 символов
- `price`: обязательно, число > 0
- `storeId`: обязательно, существующий ID магазина
- `categoryId`: опционально, существующий ID категории
- `image`: опционально, валидный URL
- `description`: опционально, строка до 1000 символов

---

### PUT /api/products/:id
Обновить существующий продукт.

**Параметры:**
- `id` (number): ID продукта

**Тело запроса:**
```json
{
  "name": "Обновленное название",
  "price": 149.99,
  "storeId": 2,
  "categoryId": 3,
  "image": "https://example.com/new-image.jpg",
  "description": "Новое описание"
}
```

**Ответ (200):**
```json
{
  "success": true,
  "data": {
    "id": 1,
    "name": "Обновленное название",
    "price": 149.99,
    "storeId": 2,
    "categoryId": 3,
    "image": "https://example.com/new-image.jpg",
    "description": "Новое описание",
    "updatedAt": "2025-01-21T10:30:00.000Z"
  },
  "message": "Товар успешно обновлен"
}
```

**Ошибки:**
- `404` - Продукт не найден
- `400` - Неверные данные
- `400` - Магазин или категория не найдены

---

### DELETE /api/products/:id
Удалить продукт.

**Параметры:**
- `id` (number): ID продукта

**Ответ (200):**
```json
{
  "success": true,
  "data": null,
  "message": "Товар успешно удален"
}
```

**Ошибки:**
- `404` - Продукт не найден
- `400` - Нельзя удалить товар с активными заказами

---

## 🛒 Управление заказами

### GET /api/orders/admin/all
Получить все заказы системы с расширенной информацией.

**Параметры запроса:**
- `page` (number): Номер страницы (по умолчанию: 1)
- `limit` (number): Количество на странице (1-100, по умолчанию: 20)
- `status` (string): Фильтр по статусу
- `userId` (number): Фильтр по пользователю
- `dateFrom` (string): Дата начала периода (ISO 8601)
- `dateTo` (string): Дата окончания периода (ISO 8601)
- `sortBy` (string): Поле сортировки (по умолчанию: createdAt)
- `sortOrder` (string): Порядок сортировки: asc/desc (по умолчанию: desc)

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
        "status": "NEW",
        "user": {
          "id": 1,
          "telegram_user_id": "123456789",
          "name": "Иван Иванов",
          "phone_number": "+1234567890"
        },
        "courier": {
          "id": 2,
          "name": "Петр Петров",
          "phone_number": "+9876543210"
        },
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
      "total": 150,
      "page": 1,
      "limit": 20,
      "totalPages": 8,
      "hasNext": true,
      "hasPrev": false
    }
  }
}
```

---

### PUT /api/orders/:id/status
Обновить статус заказа.

**Параметры:**
- `id` (number): ID заказа

**Тело запроса:**
```json
{
  "status": "PREPARING"
}
```

**Доступные статусы:**
- `NEW` - Новый заказ
- `WAITING_PAYMENT` - Ожидание оплаты
- `PREPARING` - Подготовка заказа
- `DELIVERING` - Доставляется
- `DELIVERED` - Доставлен
- `CANCELLED` - Отменен

**Ответ (200):**
```json
{
  "success": true,
  "data": {
    "id": 1,
    "status": "PREPARING",
    "updatedAt": "2025-01-21T10:30:00.000Z"
  },
  "message": "Статус заказа обновлен"
}
```

**Ошибки:**
- `404` - Заказ не найден
- `400` - Недопустимый переход статуса

---

## 📂 Управление категориями

### POST /api/categories
Создать новую категорию.

**Тело запроса:**
```json
{
  "name": "Новая категория"
}
```

**Ответ (201):**
```json
{
  "success": true,
  "data": {
    "id": 5,
    "name": "Новая категория",
    "createdAt": "2025-01-21T10:00:00.000Z"
  },
  "message": "Категория успешно создана"
}
```

**Валидация:**
- `name`: обязательно, уникальная строка 1-100 символов

**Ошибки:**
- `409` - Категория с таким названием уже существует

---

## 🏪 Управление магазинами

### POST /api/stores
Создать новый магазин.

**Тело запроса:**
```json
{
  "name": "Новый магазин",
  "address": "Москва, ул. Новая, 456",
  "description": "Описание магазина",
  "phone": "+1234567890",
  "workingHours": "9:00-21:00"
}
```

**Ответ (201):**
```json
{
  "success": true,
  "data": {
    "id": 3,
    "name": "Новый магазин",
    "address": "Москва, ул. Новая, 456",
    "description": "Описание магазина",
    "phone": "+1234567890",
    "workingHours": "9:00-21:00",
    "createdAt": "2025-01-21T10:00:00.000Z"
  },
  "message": "Магазин успешно создан"
}
```

**Валидация:**
- `name`: обязательно, строка 1-255 символов
- `address`: обязательно, строка 1-500 символов
- `description`: опционально, строка до 1000 символов
- `phone`: опционально, валидный номер телефона
- `workingHours`: опционально, строка до 100 символов

---

## 📊 Управление складом

### PUT /api/stock/:productId
Обновить остатки товара на складе.

**Параметры:**
- `productId` (number): ID продукта

**Тело запроса:**
```json
{
  "quantity": 100,
  "type": "INCOME",
  "comment": "Поступление товара"
}
```

**Типы операций:**
- `INCOME` - Поступление товара
- `OUTCOME` - Расход товара
- `CORRECTION` - Корректировка остатков

**Ответ (200):**
```json
{
  "success": true,
  "data": {
    "productId": 1,
    "quantity": 100,
    "type": "INCOME",
    "comment": "Поступление товара",
    "updatedAt": "2025-01-21T10:00:00.000Z",
    "currentStock": 150
  },
  "message": "Остатки товара обновлены"
}
```

**Ошибки:**
- `404` - Продукт не найден
- `400` - Недостаточно товара для расхода

---

## 🚚 Управление курьерами

### POST /api/courier/assign
Назначить курьера на заказ.

**Тело запроса:**
```json
{
  "courierId": 1,
  "orderId": 15
}
```

**Ответ (200):**
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
    "updatedAt": "2025-01-21T10:15:00.000Z"
  },
  "message": "Курьер назначен на заказ"
}
```

**Ошибки:**
- `404` - Заказ или курьер не найден
- `400` - Заказ уже назначен другому курьеру
- `400` - Неверный статус заказа для назначения

---

### GET /api/courier/list
Получить список всех курьеров с статистикой.

**Параметры запроса:**
- `page` (number): Номер страницы (по умолчанию: 1)
- `limit` (number): Количество на странице (1-50, по умолчанию: 10)
- `search` (string): Поиск по имени или телефону
- `sortBy` (string): Поле сортировки (по умолчанию: name)
- `sortOrder` (string): Порядок сортировки: asc/desc (по умолчанию: asc)

**Ответ (200):**
```json
{
  "success": true,
  "data": {
    "couriers": [
      {
        "id": 1,
        "telegram_user_id": "987654321",
        "name": "Петр Петров",
        "phone": "+9876543210",
        "createdAt": "2025-01-21T09:00:00.000Z",
        "stats": {
          "totalDelivered": 25,
          "activeOrders": 3,
          "rating": 4.8,
          "lastDelivery": "2025-01-21T09:30:00.000Z"
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

---

### GET /api/courier/:id/stats
Получить детальную статистику курьера.

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
      "name": "Петр Петров",
      "phone": "+9876543210"
    },
    "stats": {
      "totalOrders": 30,
      "deliveredOrders": 25,
      "activeOrders": 3,
      "cancelledOrders": 2,
      "averageDeliveryTime": 45.5,
      "rating": 4.8,
      "efficiency": "Отличная",
      "monthlyStats": {
        "delivered": 12,
        "earnings": 15000
      },
      "lastDelivery": "2025-01-21T09:30:00.000Z"
    }
  }
}
```

**Ошибки:**
- `404` - Курьер не найден

---

## 📈 Мониторинг и безопасность

### GET /security-stats
Получить статистику безопасности системы.

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
        "attempts": 15,
        "duration": 3600
      }
    ],
    "suspiciousActivity": [
      {
        "ip": "10.0.0.50",
        "userAgent": "sqlmap/1.0",
        "endpoint": "/api/products",
        "timestamp": "2025-01-21T09:45:00.000Z",
        "reason": "Suspicious User-Agent",
        "severity": "HIGH"
      }
    ],
    "rateLimitViolations": {
      "last24h": 45,
      "lastHour": 8,
      "byIP": {
        "192.168.1.100": 15,
        "10.0.0.50": 8
      }
    },
    "authenticationFailures": {
      "last24h": 12,
      "lastHour": 2
    },
    "summary": {
      "totalThreats": 3,
      "activeBans": 1,
      "securityLevel": "NORMAL"
    }
  }
}
```

---

## 🔧 Административные операции

### GET /api/user/admin/all
Получить список всех пользователей системы с расширенной информацией.

**Параметры запроса:**
- `page` (number): Номер страницы (по умолчанию: 1)
- `limit` (number): Количество на странице (1-100, по умолчанию: 20)
- `role` (string): Фильтр по роли (ADMIN, CUSTOMER, COURIER)
- `search` (string): Поиск по имени, телефону или Telegram ID
- `sortBy` (string): Поле сортировки (по умолчанию: id)
- `sortOrder` (string): Порядок сортировки: asc/desc (по умолчанию: desc)

**Ответ (200):**
```json
{
  "success": true,
  "data": {
    "users": [
      {
        "id": 1,
        "telegram_user_id": "123456789",
        "name": "Иван Иванов",
        "phone_number": "+1234567890",
        "role": "CUSTOMER",
        "stats": {
          "totalOrders": 5
        }
      },
      {
        "id": 2,
        "telegram_user_id": "987654321",
        "name": "Петр Петров",
        "phone_number": "+9876543210",
        "role": "COURIER",
        "stats": {
          "totalOrders": 30,
          "deliveredOrders": 25,
          "activeOrders": 3
        }
      }
    ],
    "pagination": {
      "total": 45,
      "page": 1,
      "limit": 20,
      "totalPages": 3,
      "hasNext": true,
      "hasPrev": false
    }
  }
}
```

**Особенности:**
- Для курьеров показывается расширенная статистика (доставленные заказы, активные заказы)
- Для обычных пользователей показывается только общее количество заказов
- Поиск работает по имени, номеру телефона и Telegram ID
- Фильтрация по ролям позволяет быстро найти админов, курьеров или клиентов

**Ошибки:**
- `400` - Неверные параметры запроса
- `401` - Требуется авторизация
- `403` - Требуются права администратора

---

### POST /api/admin/users/:id/role
Изменить роль пользователя.

**Параметры:**
- `id` (number): ID пользователя

**Тело запроса:**
```json
{
  "role": "COURIER"
}
```

**Доступные роли:**
- `CUSTOMER` - Обычный пользователь
- `COURIER` - Курьер
- `ADMIN` - Администратор

**Ответ (200):**
```json
{
  "success": true,
  "data": {
    "userId": 5,
    "oldRole": "CUSTOMER",
    "newRole": "COURIER",
    "updatedAt": "2025-01-21T10:00:00.000Z"
  },
  "message": "Роль пользователя изменена"
}
```

**Ошибки:**
- `400` - Неверный ID пользователя или недопустимая роль
- `400` - Роль уже установлена
- `401` - Требуется авторизация
- `403` - Требуются права администратора
- `404` - Пользователь не найден
- `429` - Превышен лимит запросов

---

### POST /api/admin/system/cache/clear
Очистить кэш системы.

**Тело запроса:**
```json
{
  "pattern": "products:*"
}
```

**Ответ (200):**
```json
{
  "success": true,
  "data": {
    "clearedKeys": 25,
    "pattern": "products:*",
    "timestamp": "2025-01-21T10:00:00.000Z"
  },
  "message": "Кэш очищен"
}
```

---

## 📊 Отчеты и аналитика

### GET /api/admin/reports/sales
Получить отчет по продажам.

**Параметры запроса:**
- `period` (string): Период отчета (day, week, month, year)
- `dateFrom` (string): Дата начала (ISO 8601)
- `dateTo` (string): Дата окончания (ISO 8601)
- `storeId` (number): Фильтр по магазину
- `categoryId` (number): Фильтр по категории

**Ответ (200):**
```json
{
  "success": true,
  "data": {
    "summary": {
      "totalOrders": 150,
      "totalRevenue": 45000.50,
      "averageOrderValue": 300.00,
      "period": "month"
    },
    "trends": {
      "ordersGrowth": "+15%",
      "revenueGrowth": "+22%"
    },
    "topProducts": [
      {
        "id": 1,
        "name": "Органические яблоки",
        "sales": 45,
        "revenue": 8995.55
      }
    ],
    "dailyStats": [
      {
        "date": "2025-01-21",
        "orders": 12,
        "revenue": 3600.00
      }
    ]
  }
}
```

---

## 🚫 Ошибки и коды ответов

### Общие ошибки админских эндпоинтов:

**401 Unauthorized:**
```json
{
  "success": false,
  "error": {
    "code": "UNAUTHORIZED",
    "message": "Требуется авторизация"
  }
}
```

**403 Forbidden:**
```json
{
  "success": false,
  "error": {
    "code": "ADMIN_REQUIRED",
    "message": "Требуются права администратора"
  }
}
```

**429 Too Many Requests:**
```json
{
  "success": false,
  "error": {
    "code": "RATE_LIMIT_ADMIN",
    "message": "Превышен лимит запросов для администраторов (200/15мин)"
  }
}
```

---

## 📚 Примеры использования

### JavaScript/TypeScript
```javascript
// Получение админского токена
const authResponse = await fetch('/api/auth', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ telegram_user_id: 'admin_telegram_id' })
});
const { data } = await authResponse.json();
const adminToken = data.token;

// Создание продукта
const createProduct = async () => {
  const response = await fetch('/api/products', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${adminToken}`
    },
    body: JSON.stringify({
      name: "Новый продукт",
      price: 99.99,
      storeId: 1,
      categoryId: 2
    })
  });
  return response.json();
};

// Назначение курьера
const assignCourier = async (orderId, courierId) => {
  const response = await fetch('/api/courier/assign', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${adminToken}`
    },
    body: JSON.stringify({ orderId, courierId })
  });
  return response.json();
};

// Получение всех пользователей
const getAllUsers = async (page = 1, role = null) => {
  const params = new URLSearchParams({ page: page.toString() });
  if (role) params.append('role', role);
  
  const response = await fetch(`/api/user/admin/all?${params}`, {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${adminToken}`
    }
  });
  return response.json();
};

// Изменение роли пользователя
const changeUserRole = async (userId, newRole) => {
  const response = await fetch(`/api/admin/users/${userId}/role`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${adminToken}`
    },
    body: JSON.stringify({ role: newRole })
  });
  return response.json();
};
```

### cURL
```bash
# Создание категории
curl -X POST https://eco-b-6sgyz.ondigitalocean.app/api/categories \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer ADMIN_TOKEN" \
  -d '{"name": "Новая категория"}'

# Обновление статуса заказа
curl -X PUT https://eco-b-6sgyz.ondigitalocean.app/api/orders/123/status \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer ADMIN_TOKEN" \
  -d '{"status": "PREPARING"}'

# Получение статистики безопасности
curl -X GET https://eco-b-6sgyz.ondigitalocean.app/security-stats \
  -H "Authorization: Bearer ADMIN_TOKEN"

# Получение всех пользователей
curl -X GET "https://eco-b-6sgyz.ondigitalocean.app/api/user/admin/all?page=1&limit=10&role=COURIER" \
  -H "Authorization: Bearer ADMIN_TOKEN"

# Поиск пользователей по имени
curl -X GET "https://eco-b-6sgyz.ondigitalocean.app/api/user/admin/all?search=Иван&page=1" \
  -H "Authorization: Bearer ADMIN_TOKEN"

# Изменение роли пользователя
curl -X POST https://eco-b-6sgyz.ondigitalocean.app/api/admin/users/5/role \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer ADMIN_TOKEN" \
  -d '{"role": "COURIER"}'

# Обновление остатков товара на складе
curl -X PUT https://eco-b-6sgyz.ondigitalocean.app/api/stock/3 \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer ADMIN_TOKEN" \
  -d '{"quantity": 100, "type": "INCOME", "comment": "Поступление товара"}'
```

---

## ⚡ Производительность и ограничения

### Rate Limiting для админов:
- **Лимит**: 200 запросов за 15 минут
- **Приоритет**: Высокий (админские запросы обрабатываются первыми)
- **Мониторинг**: Все админские действия логируются

### Рекомендации:
- Используйте пагинацию для больших списков
- Применяйте фильтры для оптимизации запросов
- Кэшируйте данные на клиенте где возможно
- Мониторьте статистику безопасности регулярно

---

**Документация обновлена:** 22 июля 2025 г.
**Версия API:** 2.0
