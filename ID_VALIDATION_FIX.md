# Исправление валидации параметра ID

## ❌ Проблема:
```
"Ошибки валидации параметров: Параметр id должен быть типа number"
```

## ✅ Решение:

### Изменен файл: `src/routes/admin.ts`
```typescript
// БЫЛО:
validateParams({
  id: { 
    required: true, 
    type: 'number' as const,  // ❌ Параметры URL всегда строки!
    custom: (value: any) => {
      const num = parseInt(value);
      return !isNaN(num) && num > 0 || 'ID должен быть положительным числом';
    }
  }
})

// СТАЛО:
validateParams(schemas.id)  // ✅ Использует готовую схему
```

### Преимущества нового подхода:
1. **Использует готовую схему** `schemas.id` из middleware
2. **Правильная валидация** для параметров URL (которые всегда строки)
3. **Автоматическая конвертация** строки в число при валидации
4. **Консистентность** с другими эндпоинтами

## 🧪 Тестирование:

**Теперь эти запросы должны работать:**
```bash
# Правильный ID
curl -X POST http://localhost:4000/api/admin/users/5/role \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer ADMIN_TOKEN" \
  -d '{"role": "COURIER"}'

# Неправильный ID (вернет ошибку валидации)
curl -X POST http://localhost:4000/api/admin/users/abc/role \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer ADMIN_TOKEN" \
  -d '{"role": "COURIER"}'
```

## 📚 Обновлена документация:
- ✅ `ADMIN_API.md` - добавлен раздел с ошибками
- ✅ `USER_ROLE_ENDPOINT.md` - добавлены исправления v2

---

**Статус:** ✅ Исправлено  
**Дата:** 22 июля 2025 г.
