# EcoBazar Backend

Улучшенный backend для платформы EcoBazar с современными практиками разработки, усиленной безопасностью и полным мониторингом.

## 🚀 Основные улучшения

### ✨ Новые возможности
- **Сервисный слой** - Бизнес-логика вынесена в отдельные сервисы
- **Продвинутая валидация** - Использование Zod для типобезопасной валидации
- **Кэширование** - Встроенная система кэширования для оптимизации производительности
- **Метрики и мониторинг** - Подробная аналитика производительности
- **Улучшенное логирование** - Структурированные логи с ротацией файлов
- **Усиленная безопасность** - Защита от SQL injection, XSS, rate limiting
- **Тестирование** - Полное покрытие тестами

### 🛡️ Безопасность
- JWT аутентификация с проверкой ролей
- Rate limiting с блокировкой подозрительных IP
- Защита от SQL injection и XSS
- Валидация User-Agent и размера запросов
- Безопасные HTTP заголовки
- CORS политики

### 📊 Мониторинг
- Real-time метрики производительности
- Health check эндпоинты
- Логирование безопасности
- Мониторинг использования памяти
- Отслеживание времени ответа

## 📋 Требования

- Node.js 18+
- PostgreSQL 14+
- npm или yarn

## 🚀 Быстрый старт

### 1. Установка зависимостей
```bash
npm install
```

### 2. Настройка окружения
Создайте файл `.env`:
```env
DATABASE_URL="postgresql://username:password@localhost:5432/ecobazar"
JWT_SECRET="your-super-secret-jwt-key"
PORT=4000
NODE_ENV=development
ALLOWED_ORIGINS="http://localhost:3000,http://localhost:3001"
METRICS_TOKEN="your-metrics-token"
ADMIN_TOKEN="your-admin-token"
```

### 3. Настройка базы данных
```bash
# Генерация Prisma клиента
npm run db:generate

# Применение миграций
npm run db:migrate

# Заполнение тестовыми данными
npm run db:seed
```

### 4. Запуск приложения

#### Разработка (оригинальная версия)
```bash
npm run dev
```

#### Разработка (улучшенная версия V2)
```bash
npm run dev:v2
```

#### Продакшн
```bash
npm run build
npm run start:v2
```

## 🧪 Тестирование

### Запуск тестов
```bash
# Все тесты
npm test

# Тесты в watch режиме
npm run test:watch

# Покрытие кода
npm run test:coverage
```

### Линтинг
```bash
# Проверка кода
npm run lint

# Автоисправление
npm run lint:fix
```

## 📚 API Документация

### Аутентификация
```http
POST /api/auth
Content-Type: application/json

{
  "telegram_user_id": "123456789"
}
```

### Продукты
```http
# Получить все продукты
GET /api/products?page=1&limit=10&search=товар&categoryId=1

# Получить продукт по ID
GET /api/products/:id

# Создать продукт (только для админов)
POST /api/products
Authorization: Bearer <token>
Content-Type: application/json

{
  "name": "Новый товар",
  "price": 99.99,
  "storeId": 1,
  "categoryId": 1,
  "image": "https://example.com/image.jpg"
}
```

### Заказы
```http
# Создать заказ
POST /api/orders
Authorization: Bearer <token>
Content-Type: application/json

{
  "items": [
    {
      "productId": 1,
      "quantity": 2
    }
  ],
  "address": "ул. Примерная, 123"
}

# Получить свои заказы
GET /api/orders
Authorization: Bearer <token>

# Получить все заказы (только для админов)
GET /api/orders/admin/all
Authorization: Bearer <token>
```

## 📊 Мониторинг и Метрики

### Health Check
```http
GET /health
```

Возвращает:
```json
{
  "status": "healthy",
  "timestamp": "2025-01-21T10:00:00.000Z",
  "version": "1.0.0",
  "environment": "development",
  "uptime": 3600,
  "metrics": {
    "uptime": 3600,
    "memoryUsedMB": 128,
    "totalRequests": 1000,
    "errorRate": "0.5",
    "activeConnections": 5
  }
}
```

### Метрики (требует токен в продакшне)
```http
GET /metrics
Authorization: Bearer <metrics-token>
```

### Статистика безопасности (требует админ токен)
```http
GET /security-stats
Authorization: Bearer <admin-token>
```

## 🗂️ Структура проекта

```
src/
├── controllers/           # Контроллеры (V1 и V2)
├── services/             # Бизнес-логика
├── middlewares/          # Middleware функции
├── routes/               # Маршруты API
├── utils/                # Утилиты
│   ├── cache.ts         # Система кэширования
│   ├── logger.ts        # Логирование
│   ├── metrics.ts       # Метрики
│   └── security.ts      # Безопасность
├── validators/           # Схемы валидации
├── types/               # TypeScript типы
├── lib/                 # Конфигурации
└── app.ts / appV2.ts    # Основные файлы приложения

tests/                   # Тесты
├── setup.ts            # Настройка тестов
└── *.test.ts           # Файлы тестов

prisma/                 # Схема и миграции БД
logs/                   # Файлы логов
```

## 🔧 Конфигурация

### Переменные окружения

| Переменная | Описание | По умолчанию |
|------------|----------|--------------|
| `DATABASE_URL` | URL подключения к PostgreSQL | - |
| `JWT_SECRET` | Секретный ключ для JWT | - |
| `PORT` | Порт сервера | 4000 |
| `NODE_ENV` | Среда выполнения | development |
| `ALLOWED_ORIGINS` | CORS origins (через запятую) | http://localhost:3000 |
| `METRICS_TOKEN` | Токен для доступа к метрикам | - |
| `ADMIN_TOKEN` | Токен для админ эндпоинтов | - |

### Настройки безопасности

- **Rate Limiting**: 1000 запросов за 15 минут для обычных пользователей
- **Admin Rate Limiting**: 100 запросов за 15 минут для админов
- **Body Size Limit**: 10MB максимум
- **Auto IP Blocking**: После 5 нарушений rate limit

### Настройки кэширования

- **Продукты**: 5 минут
- **Отдельный продукт**: 10 минут
- **Заказы**: 2 минуты
- **Склад**: 2 минуты

## 🚀 Деплой

### Docker
```dockerfile
FROM node:18-alpine

WORKDIR /app

COPY package*.json ./
RUN npm ci --only=production

COPY . .
RUN npm run build

EXPOSE 4000

CMD ["npm", "run", "start:v2"]
```

### Docker Compose
```yaml
version: '3.8'
services:
  app:
    build: .
    ports:
      - "4000:4000"
    environment:
      - NODE_ENV=production
      - DATABASE_URL=postgresql://user:password@db:5432/ecobazar
    depends_on:
      - db
  
  db:
    image: postgres:14
    environment:
      POSTGRES_DB: ecobazar
      POSTGRES_USER: user
      POSTGRES_PASSWORD: password
    volumes:
      - postgres_data:/var/lib/postgresql/data

volumes:
  postgres_data:
```

## 📈 Производительность

### Оптимизации
- **Сжатие gzip** для всех ответов > 1KB
- **Кэширование** часто запрашиваемых данных
- **Пагинация** с лимитом в 100 записей
- **Ленивая загрузка** связанных данных
- **Индексы БД** для критичных запросов

### Мониторинг
- Автоматическое отслеживание времени ответа
- Мониторинг использования памяти
- Счетчики ошибок по эндпоинтам
- Логирование медленных запросов

## 🤝 Вклад в разработку

1. Fork репозиторий
2. Создайте feature ветку (`git checkout -b feature/amazing-feature`)
3. Commit изменения (`git commit -m 'Add amazing feature'`)
4. Push в ветку (`git push origin feature/amazing-feature`)
5. Откройте Pull Request

### Правила разработки
- Покрытие тестами новой функциональности
- Соблюдение ESLint правил
- Документирование API изменений
- Обновление версии в package.json

## 📄 Лицензия

MIT License - подробности в файле [LICENSE](LICENSE)

## 📞 Поддержка

Если у вас есть вопросы или предложения:
- Создайте [Issue](https://github.com/your-repo/issues)
- Напишите в [Discussions](https://github.com/your-repo/discussions)

---

Made with ❤️ by EcoBazar Team
