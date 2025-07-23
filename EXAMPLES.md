# 📖 Примеры использования EcoBazar Backend v2.0

Практические примеры взаимодействия с API улучшенной версии EcoBazar Backend.

## 🔐 Аутентификация

### Базовая аутентификация
```bash
# Авторизация пользователя
curl -X POST http://localhost:4000/api/auth \
  -H "Content-Type: application/json" \
  -d '{"telegram_user_id": "123456789"}'
```

**Ответ:**
```json
{
  "success": true,
  "data": {
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "user": {
      "id": 1,
      "telegram_user_id": "123456789",
      "role": "CUSTOMER",
      "name": null,
      "phone_number": null
    }
  },
  "message": "Пользователь успешно зарегистрирован"
}
```

### JavaScript/TypeScript пример
```javascript
class EcoBazarAPI {
  constructor(baseURL = 'http://localhost:4000') {
    this.baseURL = baseURL;
    this.token = null;
  }

  async auth(telegramUserId) {
    const response = await fetch(`${this.baseURL}/api/auth`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ telegram_user_id: telegramUserId })
    });
    
    const data = await response.json();
    if (data.success) {
      this.token = data.data.token;
    }
    return data;
  }

  getHeaders() {
    return {
      'Content-Type': 'application/json',
      ...(this.token && { 'Authorization': `Bearer ${this.token}` })
    };
  }
}

// Использование
const api = new EcoBazarAPI();
await api.auth('123456789');
```

## 🛍️ Работа с продуктами

### Получение списка продуктов
```bash
# Базовый запрос
curl http://localhost:4000/api/products

# С пагинацией
curl "http://localhost:4000/api/products?page=2&limit=5"

# С поиском
curl "http://localhost:4000/api/products?search=яблоки"

# С фильтрацией
curl "http://localhost:4000/api/products?categoryId=1&minPrice=50&maxPrice=200"
```

### JavaScript пример
```javascript
class ProductService extends EcoBazarAPI {
  async getProducts(options = {}) {
    const params = new URLSearchParams();
    
    if (options.page) params.append('page', options.page);
    if (options.limit) params.append('limit', options.limit);
    if (options.search) params.append('search', options.search);
    if (options.categoryId) params.append('categoryId', options.categoryId);
    if (options.minPrice) params.append('minPrice', options.minPrice);
    if (options.maxPrice) params.append('maxPrice', options.maxPrice);

    const response = await fetch(`${this.baseURL}/api/products?${params}`);
    return response.json();
  }

  async getProduct(id) {
    const response = await fetch(`${this.baseURL}/api/products/${id}`);
    return response.json();
  }

  async createProduct(productData) {
    const response = await fetch(`${this.baseURL}/api/products`, {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify(productData)
    });
    return response.json();
  }
}

// Использование
const productService = new ProductService();
await productService.auth('admin_telegram_id');

// Получить все продукты
const products = await productService.getProducts();

// Поиск продуктов
const searchResults = await productService.getProducts({
  search: 'яблоки',
  categoryId: 1,
  page: 1,
  limit: 20
});

// Создать продукт (только для админов)
const newProduct = await productService.createProduct({
  name: 'Био томаты',
  price: 299.99,
  storeId: 1,
  categoryId: 2,
  image: 'https://example.com/tomatoes.jpg'
});
```

## 🛒 Управление заказами

### Создание заказа
```bash
# Сначала получите токен через аутентификацию
TOKEN="your_jwt_token_here"

curl -X POST http://localhost:4000/api/orders \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "items": [
      {"productId": 1, "quantity": 2},
      {"productId": 3, "quantity": 1}
    ],
    "address": "ул. Примерная, 123, кв. 45"
  }'
```

### JavaScript пример
```javascript
class OrderService extends EcoBazarAPI {
  async createOrder(orderData) {
    const response = await fetch(`${this.baseURL}/api/orders`, {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify(orderData)
    });
    return response.json();
  }

  async getMyOrders(page = 1, limit = 10) {
    const response = await fetch(
      `${this.baseURL}/api/orders?page=${page}&limit=${limit}`,
      { headers: this.getHeaders() }
    );
    return response.json();
  }

  async getOrder(orderId) {
    const response = await fetch(`${this.baseURL}/api/orders/${orderId}`, {
      headers: this.getHeaders()
    });
    return response.json();
  }

  async updateOrderStatus(orderId, status) {
    const response = await fetch(`${this.baseURL}/api/orders/${orderId}/status`, {
      method: 'PUT',
      headers: this.getHeaders(),
      body: JSON.stringify({ status })
    });
    return response.json();
  }
}

// Использование
const orderService = new OrderService();
await orderService.auth('123456789');

// Создать заказ
const order = await orderService.createOrder({
  items: [
    { productId: 1, quantity: 2 },
    { productId: 5, quantity: 1 }
  ],
  address: 'ул. Тестовая, 123'
});

// Получить свои заказы
const myOrders = await orderService.getMyOrders();

// Обновить статус заказа (только для админов)
// await orderService.updateOrderStatus(1, 'PREPARING');
```

## 📊 Мониторинг и метрики

### Проверка состояния
```bash
# Health check
curl http://localhost:4000/health

# Системные метрики
curl http://localhost:4000/metrics

# Статистика безопасности (требует админ токен)
curl -H "Authorization: Bearer $ADMIN_TOKEN" \
  http://localhost:4000/security-stats
```

### Мониторинг в реальном времени
```bash
# Мониторинг health в реальном времени
watch -n 5 'curl -s http://localhost:4000/health | jq .'

# Мониторинг метрик
watch -n 10 'curl -s http://localhost:4000/metrics | jq .memoryUsage'

# Мониторинг количества запросов
watch -n 5 'curl -s http://localhost:4000/metrics | jq .totalRequests'
```

### JavaScript пример мониторинга
```javascript
class MonitoringService {
  constructor(baseURL = 'http://localhost:4000', metricsToken = null) {
    this.baseURL = baseURL;
    this.metricsToken = metricsToken;
  }

  async getHealth() {
    const response = await fetch(`${this.baseURL}/health`);
    return response.json();
  }

  async getMetrics() {
    const headers = {};
    if (this.metricsToken) {
      headers['Authorization'] = `Bearer ${this.metricsToken}`;
    }

    const response = await fetch(`${this.baseURL}/metrics`, { headers });
    return response.json();
  }

  async getSecurityStats(adminToken) {
    const response = await fetch(`${this.baseURL}/security-stats`, {
      headers: { 'Authorization': `Bearer ${adminToken}` }
    });
    return response.json();
  }

  // Периодический мониторинг
  startMonitoring(interval = 30000) {
    return setInterval(async () => {
      try {
        const health = await this.getHealth();
        const metrics = await this.getMetrics();
        
        console.log(`
🔋 Статус: ${health.status}
💾 Память: ${metrics.memoryUsage.usedMemoryMB}MB
📊 Запросов: ${metrics.totalRequests}
⏱️  Uptime: ${Math.floor(metrics.uptime/60)} минут
        `);
      } catch (error) {
        console.error('❌ Ошибка мониторинга:', error.message);
      }
    }, interval);
  }
}

// Использование
const monitor = new MonitoringService();

// Разовая проверка
const health = await monitor.getHealth();
const metrics = await monitor.getMetrics();

// Постоянный мониторинг каждые 30 секунд
const monitoringInterval = monitor.startMonitoring(30000);

// Остановка мониторинга
// clearInterval(monitoringInterval);
```

## 🔒 Примеры безопасности

### Rate Limiting тестирование
```bash
# Тест обычного rate limit (1000 запросов за 15 минут)
for i in {1..10}; do
  curl -w "%{http_code}\n" -o /dev/null -s http://localhost:4000/api/products
done

# Авторизация теперь без ограничений
curl -w "%{http_code}\n" -o /dev/null -s \
  -X POST http://localhost:4000/api/auth \
  -H "Content-Type: application/json" \
  -d '{"telegram_user_id": "123456789"}'
```

### Тестирование защиты от подозрительной активности
```bash
# Подозрительный User-Agent
curl -H "User-Agent: sqlmap/1.0" http://localhost:4000/api/products

# Слишком большой запрос (будет отклонен)
curl -X POST http://localhost:4000/api/auth \
  -H "Content-Type: application/json" \
  -d "$(yes '"test":' | head -n 100000 | tr -d '\n')\"end\""
```

## 🧪 Тестовые сценарии

### Полный E2E тест
```javascript
async function runE2ETest() {
  const api = new EcoBazarAPI();
  
  console.log('🚀 Начинаем E2E тест...');
  
  try {
    // 1. Аутентификация
    console.log('1. Аутентификация...');
    const auth = await api.auth('test_user_' + Date.now());
    console.log('✅ Токен получен:', auth.data.token.substring(0, 20) + '...');
    
    // 2. Получение продуктов
    console.log('2. Получение продуктов...');
    const products = await fetch(`${api.baseURL}/api/products`);
    const productsData = await products.json();
    console.log('✅ Получено продуктов:', productsData.data?.length || 0);
    
    // 3. Создание заказа
    if (productsData.data?.length > 0) {
      console.log('3. Создание заказа...');
      const orderResponse = await fetch(`${api.baseURL}/api/orders`, {
        method: 'POST',
        headers: api.getHeaders(),
        body: JSON.stringify({
          items: [{ productId: productsData.data[0].id, quantity: 1 }],
          address: 'Тестовый адрес 123'
        })
      });
      const order = await orderResponse.json();
      console.log('✅ Заказ создан:', order.success ? 'успешно' : 'ошибка');
    }
    
    // 4. Проверка метрик
    console.log('4. Проверка метрик...');
    const metricsResponse = await fetch(`${api.baseURL}/metrics`);
    const metrics = await metricsResponse.json();
    console.log('✅ Метрики получены. Запросов:', metrics.totalRequests);
    
    console.log('🎉 E2E тест завершен успешно!');
    
  } catch (error) {
    console.error('❌ Ошибка в E2E тесте:', error.message);
  }
}

// Запуск теста
runE2ETest();
```

### Тест производительности
```javascript
async function performanceTest() {
  const api = new EcoBazarAPI();
  await api.auth('perf_test_user');
  
  const startTime = Date.now();
  const requests = 100;
  const promises = [];
  
  console.log(`🚀 Тест производительности: ${requests} запросов...`);
  
  for (let i = 0; i < requests; i++) {
    promises.push(
      fetch(`${api.baseURL}/api/products?page=${i % 5 + 1}`)
    );
  }
  
  const results = await Promise.all(promises);
  const endTime = Date.now();
  
  const successCount = results.filter(r => r.ok).length;
  const avgTime = (endTime - startTime) / requests;
  
  console.log(`
📊 Результаты теста производительности:
✅ Успешных запросов: ${successCount}/${requests}
⏱️  Среднее время: ${avgTime.toFixed(2)}ms
🔥 Запросов в секунду: ${(1000 / avgTime).toFixed(2)}
  `);
}

// performanceTest();
```

## 📱 React/Next.js интеграция

### Хук для работы с API
```javascript
// hooks/useEcoBazarAPI.js
import { useState, useEffect } from 'react';

export function useEcoBazarAPI(baseURL = 'http://localhost:4000') {
  const [token, setToken] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const api = async (endpoint, options = {}) => {
    setLoading(true);
    setError(null);
    
    try {
      const response = await fetch(`${baseURL}${endpoint}`, {
        ...options,
        headers: {
          'Content-Type': 'application/json',
          ...(token && { 'Authorization': `Bearer ${token}` }),
          ...options.headers
        }
      });
      
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error?.message || 'Ошибка API');
      }
      
      return data;
    } catch (err) {
      setError(err.message);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const auth = async (telegramUserId) => {
    const data = await api('/api/auth', {
      method: 'POST',
      body: JSON.stringify({ telegram_user_id: telegramUserId })
    });
    
    if (data.success) {
      setToken(data.data.token);
      localStorage.setItem('ecobazar_token', data.data.token);
    }
    
    return data;
  };

  const getProducts = (params = {}) => {
    const searchParams = new URLSearchParams(params);
    return api(`/api/products?${searchParams}`);
  };

  const createOrder = (orderData) => {
    return api('/api/orders', {
      method: 'POST',
      body: JSON.stringify(orderData)
    });
  };

  // Восстановление токена при загрузке
  useEffect(() => {
    const savedToken = localStorage.getItem('ecobazar_token');
    if (savedToken) {
      setToken(savedToken);
    }
  }, []);

  return {
    auth,
    getProducts,
    createOrder,
    api,
    token,
    loading,
    error,
    isAuthenticated: !!token
  };
}
```

### Компонент списка продуктов
```javascript
// components/ProductList.jsx
import { useState, useEffect } from 'react';
import { useEcoBazarAPI } from '../hooks/useEcoBazarAPI';

export function ProductList() {
  const { getProducts, loading, error } = useEcoBazarAPI();
  const [products, setProducts] = useState([]);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);

  useEffect(() => {
    loadProducts();
  }, [search, page]);

  const loadProducts = async () => {
    try {
      const data = await getProducts({ search, page, limit: 12 });
      if (data.success) {
        setProducts(data.data);
      }
    } catch (err) {
      console.error('Ошибка загрузки продуктов:', err);
    }
  };

  if (loading) return <div>⏳ Загрузка...</div>;
  if (error) return <div>❌ Ошибка: {error}</div>;

  return (
    <div>
      <input 
        type="text"
        placeholder="Поиск продуктов..."
        value={search}
        onChange={(e) => setSearch(e.target.value)}
      />
      
      <div className="products-grid">
        {products.map(product => (
          <div key={product.id} className="product-card">
            <h3>{product.name}</h3>
            <p>💰 {product.price} ₸</p>
            <p>🏪 {product.store?.name}</p>
            <p>📦 {product.stock > 0 ? `В наличии: ${product.stock}` : 'Нет в наличии'}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
```

---

## 📝 Заключение

Эти примеры демонстрируют основные возможности EcoBazar Backend v2.0:

- ✅ **Простая аутентификация** через Telegram ID
- ✅ **Мощный API продуктов** с поиском и фильтрацией  
- ✅ **Удобное управление заказами**
- ✅ **Комплексный мониторинг** и метрики
- ✅ **Надежная безопасность** с rate limiting
- ✅ **Легкая интеграция** с фронтенд фреймворками

Используйте эти примеры как основу для своих приложений! 🚀
