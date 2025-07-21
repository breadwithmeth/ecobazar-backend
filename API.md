---

## Категории

### GET `/api/categories`
- Получить список категорий
- Ответ: `[{ id, name }]`

### POST `/api/categories` (только ADMIN)
- Создать категорию
- Body: `{ name }`
- Ответ: категория

### PUT `/api/categories/:id` (только ADMIN)
- Обновить категорию
- Body: `{ name }`
- Ответ: категория

### DELETE `/api/categories/:id` (только ADMIN)
- Удалить категорию
- Ответ: `{ success: true }`
# Ecobazar Backend API

## Аутентификация



### POST `/api/auth`
- Регистрация или авторизация пользователя по telegram_user_id
- Если пользователь существует — выполняется вход, иначе регистрация
- Body:
  - `{ telegram_user_id }`
- Ответ: `{ token }`

---

## Магазины

### GET `/api/stores`
- Получить список магазинов
- Ответ: `[{ id, name, address }]`

### POST `/api/stores` (только ADMIN)
- Создать магазин
- Body: `{ name, address }`
- Ответ: магазин

---

## Товары

### GET `/api/products`
- Получить список товаров
- Ответ: `[{ id, name, price, image, storeId, store }]`


### POST `/api/products` (только ADMIN)
- Добавить товар
- Body: `{ name, price, image?, storeId, categoryId? }`
- Ответ: товар

### PATCH `/api/products/:id/price` (только ADMIN)
- Изменить цену товара
- Body: `{ price: number }`
- Ответ: обновлённый товар
- Требует JWT и роль ADMIN

---

## Учёт остатков

### POST `/api/stock/movements` (только ADMIN)
- Поступление/списание товара
- Body: `{ productId, quantity, type }` (`type`: INCOME | OUTCOME)
- Ответ: движение

### GET `/api/stock/:productId` (только ADMIN)
- Текущий остаток по товару
- Ответ: `{ productId, stock }`

### GET `/api/stock/history/:productId` (только ADMIN)
- История движений по товару
- Ответ: массив движений

---

## Заказы


### POST `/api/orders`
- Оформить заказ
- Body: `{ items: [{ productId, quantity }], address: string, comment?: string }`
- Ответ: заказ


### PUT `/api/orders/:id/status` (только ADMIN)
- Изменить статус заказа
- Body: `{ status }` (`status`: NEW, WAITING_PAYMENT, ASSEMBLY, SHIPPING, DELIVERED)
- Ответ: заказ
- Требует JWT и роль ADMIN



### GET `/api/orders`
- Получить список заказов текущего пользователя (кроме доставленных)
- Ответ: массив заказов с товарами и последним статусом (поле `status`)
- Требует JWT

### GET `/api/orders/all` (только ADMIN)
- Получить все заказы (от новых к старым)
- Ответ: массив заказов с товарами, пользователем, статусами и адресом

---

## Роли и доступ
- Все POST/GET, кроме `/auth/*`, требуют JWT (заголовок `Authorization: Bearer <token>`)
- ADMIN: может создавать магазины, товары, движения остатков, смотреть остатки и историю
- CUSTOMER: может только просматривать товары/магазины и оформлять заказы


## Адреса пользователя


### GET `/api/user/me`
- Получить информацию о текущем пользователе (id, telegram_user_id, role, phone_number, name)
- Требует JWT

### PATCH `/api/user/me`
- Изменить имя и/или номер телефона текущего пользователя
- Body: `{ name?: string, phone_number?: string }`
- Ответ: обновлённый пользователь
- Требует JWT


### GET `/api/user/addresses`
- Получить все адреса текущего пользователя
- Ответ: массив адресов
- Требует JWT

### POST `/api/user/addresses`
- Добавить адрес доставки
- Body: `{ address }`
- Ответ: созданный адрес
- Требует JWT

### DELETE `/api/user/addresses/:id`
- Удалить адрес доставки по id
- Ответ: `{ success: true }`
- Требует JWT

## User
- Структура пользователя:
  - `id`: number
  - `telegram_user_id`: string
  - `role`: "ADMIN" | "CUSTOMER"
  - `addresses`: массив адресов пользователя
