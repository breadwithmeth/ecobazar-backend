import { Router } from 'express';
import { registerOrLogin } from '../controllers/authController';
import { validateBody } from '../middlewares/validation';

const router = Router();

// Регистрация или вход через Telegram
router.post('/', 
  validateBody({
    telegram_user_id: { 
      required: true, 
      custom: (value: any) => {
        // Проверяем, что это строка или число
        if (typeof value !== 'string' && typeof value !== 'number') {
          return 'telegram_user_id должен быть строкой или числом';
        }
        
        // Конвертируем в строку и проверяем формат
        const str = String(value);
        if (!/^\d+$/.test(str)) {
          return 'telegram_user_id должен содержать только цифры';
        }
        
        // Проверяем длину (ID Telegram обычно от 5 до 15 символов)
        if (str.length < 3 || str.length > 15) {
          return 'telegram_user_id должен содержать от 5 до 15 цифр';
        }
        
        return true;
      }
    }
  }),
  registerOrLogin
);

export default router;
