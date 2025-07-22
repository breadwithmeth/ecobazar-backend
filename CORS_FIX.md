# CORS Настройка для EcoBazar Backend

## Проблема
Frontend на домене `https://eco-f-ifjiw.ondigitalocean.app` не может отправлять запросы к backend API из-за ограничений CORS (Cross-Origin Resource Sharing).

## Решение
Добавлен домен frontend в список разрешенных источников в настройках CORS.

## Изменения в коде

### 1. Обновлен src/app.ts
```typescript
// CORS настройки
app.use(cors({
  origin: process.env.ALLOWED_ORIGINS?.split(',') || [
    'http://localhost:3000',
    'https://eco-f-ifjiw.ondigitalocean.app'  // Добавлен ваш frontend домен
  ],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
  maxAge: 86400 // 24 часа
}));
```

### 2. Обновлен src/appV2.ts
```typescript
// CORS настройки - разрешаем доступ из разрешенных источников
app.use(cors({
  origin: process.env.ALLOWED_ORIGINS?.split(',') || [
    'http://localhost:3000',
    'https://eco-f-ifjiw.ondigitalocean.app'  // Добавлен ваш frontend домен
  ],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'X-CSRF-Token'],
  maxAge: 86400
}));
```

## Настройка переменных окружения

### Локальная разработка (.env)
```bash
ALLOWED_ORIGINS=http://localhost:3000,https://eco-f-ifjiw.ondigitalocean.app
```

### Production (.env.production)
```bash
ALLOWED_ORIGINS=http://localhost:3000,https://eco-f-ifjiw.ondigitalocean.app
```

## Развертывание на production

### Вариант 1: Обновить переменную окружения на сервере
1. Зайти в панель управления DigitalOcean App Platform
2. Найти переменную окружения `ALLOWED_ORIGINS`
3. Установить значение: `http://localhost:3000,https://eco-f-ifjiw.ondigitalocean.app`
4. Перезапустить приложение

### Вариант 2: Пересобрать и развернуть приложение
1. Закоммитить изменения в код:
   ```bash
   git add .
   git commit -m "fix: add frontend domain to CORS allowed origins"
   git push origin main
   ```
2. DigitalOcean автоматически пересоберет приложение

## Проверка работы CORS

### Проверка с frontend домена
```bash
curl -s -X OPTIONS https://eco-b-6sgyz.ondigitalocean.app/api/products \
  -H "Origin: https://eco-f-ifjiw.ondigitalocean.app" \
  -D - | grep access-control-allow-origin
```

Ожидаемый результат:
```
access-control-allow-origin: https://eco-f-ifjiw.ondigitalocean.app
```

### Проверка из браузера
1. Открыть DevTools (F12) на вашем frontend сайте
2. Выполнить тестовый запрос:
   ```javascript
   fetch('https://eco-b-6sgyz.ondigitalocean.app/api/products')
     .then(response => response.json())
     .then(data => console.log(data))
     .catch(error => console.error('CORS Error:', error));
   ```

## Дополнительные домены

Если в будущем понадобится добавить другие домены, обновите переменную `ALLOWED_ORIGINS`:

```bash
ALLOWED_ORIGINS=http://localhost:3000,https://eco-f-ifjiw.ondigitalocean.app,https://your-new-domain.com
```

## Безопасность

- ✅ Не используется `origin: '*'` для повышения безопасности
- ✅ Включен `credentials: true` для поддержки cookies
- ✅ Ограничен список разрешенных методов и заголовков
- ✅ Установлен разумный maxAge (24 часа) для кэширования preflight запросов

## Troubleshooting

### Если CORS по-прежнему не работает:

1. **Проверьте статус развертывания:**
   - Убедитесь, что изменения развернуты на production
   - Проверьте логи приложения в DigitalOcean

2. **Проверьте переменные окружения:**
   - Убедитесь, что `ALLOWED_ORIGINS` установлена правильно
   - Проверьте отсутствие лишних пробелов в значении

3. **Проверьте кэш браузера:**
   - Очистите кэш браузера
   - Попробуйте в режиме инкогнито

4. **Проверьте CDN/Proxy:**
   - Если используется CloudFlare или другой CDN, убедитесь, что они не блокируют CORS заголовки

## Дата обновления
22 июля 2025 г.
