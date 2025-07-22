-- Скрипт для создания тестовых данных для курьерской функциональности

-- Обновляем пользователя на роль ADMIN
UPDATE "User" SET role = 'ADMIN' WHERE telegram_user_id = '12345678';

-- Создаем курьера
INSERT INTO "User" (telegram_user_id, role, phone_number, name) 
VALUES ('98765432', 'COURIER', '+79001234567', 'Тестовый Курьер')
ON CONFLICT (telegram_user_id) DO UPDATE SET 
  role = 'COURIER', 
  phone_number = '+79001234567', 
  name = 'Тестовый Курьер';

-- Создаем еще одного обычного пользователя для заказов
INSERT INTO "User" (telegram_user_id, role, phone_number, name) 
VALUES ('11111111', 'CUSTOMER', '+79007654321', 'Тестовый Клиент')
ON CONFLICT (telegram_user_id) DO NOTHING;

-- Создаем магазин если не существует
INSERT INTO "Store" (name, address) 
VALUES ('Тестовый магазин', 'ул. Тестовая, 123')
ON CONFLICT DO NOTHING;

-- Создаем категорию если не существует
INSERT INTO "Category" (name) 
VALUES ('Тестовая категория')
ON CONFLICT (name) DO NOTHING;

-- Создаем тестовый продукт
INSERT INTO "Product" (name, price, "storeId", "categoryId", image) 
VALUES (
  'Тестовый товар', 
  99.99, 
  (SELECT id FROM "Store" WHERE name = 'Тестовый магазин' LIMIT 1),
  (SELECT id FROM "Category" WHERE name = 'Тестовая категория' LIMIT 1),
  'https://example.com/test-product.jpg'
)
ON CONFLICT DO NOTHING;
