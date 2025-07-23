# Назначение роли SELLER пользователю

## 🔧 Исправление завершено!

Проблема была в том, что роль `SELLER` не была включена в валидацию в некоторых контроллерах и маршрутах. Исправления внесены в:

1. `src/controllers/userController.ts` - добавлена роль SELLER в allowedRoles
2. `src/routes/admin.ts` - добавлена роль SELLER в валидацию

## 📝 Теперь вы можете назначить роль SELLER

### Шаг 1: Назначить роль SELLER пользователю

```bash
curl -X PUT https://eco-b-6sgyz.ondigitalocean.app/api/admin/users/:userId/role \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer ADMIN_TOKEN" \
  -d '{"role": "SELLER"}'
```

**Замените:**
- `:userId` - на ID пользователя
- `ADMIN_TOKEN` - на ваш админский токен

### Шаг 2: Создать магазин с владельцем

```bash
curl -X POST https://eco-b-6sgyz.ondigitalocean.app/api/stores \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer ADMIN_TOKEN" \
  -d '{
    "name": "Мой ЭкоМагазин",
    "address": "ул. Примерная, 123",
    "ownerId": USER_ID
  }'
```

### Шаг 3: Или назначить владельца существующему магазину

```bash
curl -X POST https://eco-b-6sgyz.ondigitalocean.app/api/stores/:storeId/assign-owner \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer ADMIN_TOKEN" \
  -d '{"ownerId": USER_ID}'
```

## ✅ Доступные роли теперь:

- `CUSTOMER` - Покупатель
- `COURIER` - Курьер
- `ADMIN` - Администратор
- `SELLER` - Продавец (исправлено!)

## 🎯 Полный пример назначения пользователя продавцом

```bash
# 1. Назначить роль SELLER пользователю с ID 5
curl -X PUT https://eco-b-6sgyz.ondigitalocean.app/api/admin/users/5/role \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN" \
  -d '{"role": "SELLER"}'

# 2. Создать магазин и назначить его этому пользователю
curl -X POST https://eco-b-6sgyz.ondigitalocean.app/api/stores \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN" \
  -d '{
    "name": "ЭкоМагазин Иванова",
    "address": "ул. Зеленая, 15",
    "ownerId": 5
  }'
```

## 🔍 Проверка назначения

После назначения пользователь сможет:

```bash
# Получить информацию о своем магазине
curl -X GET https://eco-b-6sgyz.ondigitalocean.app/api/stores/my/store \
  -H "Authorization: Bearer SELLER_TOKEN"

# Получить заказы своего магазина
curl -X GET https://eco-b-6sgyz.ondigitalocean.app/api/stores/my/orders \
  -H "Authorization: Bearer SELLER_TOKEN"
```

Теперь система полностью поддерживает роль SELLER!
