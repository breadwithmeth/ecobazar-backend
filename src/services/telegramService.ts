import TelegramBot, { CallbackQuery, Message } from 'node-telegram-bot-api';
import prisma from '../lib/prisma';
import { AppError } from '../middlewares/errorHandler';

interface PendingQuantityInput {
  confirmationId: number;
  productName: string;
  maxQuantity: number;
}

export class TelegramNotificationService {
  private bot: TelegramBot | null = null;
  private isProduction: boolean = false;

  constructor() {
    const token = process.env.TELEGRAM_BOT_TOKEN;
    if (!token) {
      console.warn('TELEGRAM_BOT_TOKEN не найден в переменных окружения. Telegram уведомления отключены.');
      return;
    }

    this.isProduction = process.env.NODE_ENV === 'production';
    this.bot = new TelegramBot(token, { 
      polling: true, // Включаем polling во всех режимах для обработки callback queries
      webHook: false 
    });

    console.log('🤖 Telegram бот инициализирован с polling:', true);
    this.setupBotHandlers();
    this.startCleanupTask();
  }

  private setupBotHandlers() {
    if (!this.bot) return;

    // Обработчик для подтверждения товаров
    this.bot.on('callback_query', async (query: CallbackQuery) => {
      console.log('🔔 Получен callback query:', {
        id: query.id,
        data: query.data,
        from: query.from?.username || query.from?.id
      });
      
      try {
        if (!query.data || !query.message) {
          console.log('❌ Отсутствует data или message в callback query');
          return;
        }

        const [action, confirmationId, status, quantity] = query.data.split(':');
        console.log('📊 Парсинг callback data:', { action, confirmationId, status, quantity });
        
        if (action === 'confirm_item') {
          await this.handleItemConfirmation(
            parseInt(confirmationId),
            status as 'CONFIRMED' | 'PARTIAL' | 'REJECTED',
            quantity ? parseInt(quantity) : undefined,
            query
          );
        } else if (action === 'courier_delivered') {
          const orderId = parseInt(confirmationId);
          const courierId = parseInt(status);
          await this.handleCourierDelivery(orderId, courierId, query);
        } else if (action === 'rate_delivery') {
          const orderId = parseInt(confirmationId);
          await this.handleRatingStart(query, orderId);
        } else if (action === 'quality_rating') {
          const orderId = parseInt(confirmationId);
          const quality = parseInt(status);
          const chatId = query.from.id.toString();
          await this.sendSpeedRating(chatId, orderId, quality);
        } else if (action === 'speed_rating') {
          const orderId = parseInt(confirmationId);
          const quality = parseInt(status);
          const speed = parseInt(quantity || '0');
          const chatId = query.from.id.toString();
          await this.sendImpressionRating(chatId, orderId, quality, speed);
        } else if (action === 'impression_rating') {
          const [, orderIdStr, qualityStr, speedStr, impressionStr] = query.data.split(':');
          const orderId = parseInt(orderIdStr);
          const quality = parseInt(qualityStr);
          const speed = parseInt(speedStr);
          const impression = parseInt(impressionStr);
          const chatId = query.from.id.toString();
          await this.finalizeRating(chatId, orderId, quality, speed, impression);
        }
      } catch (error) {
        console.error('Ошибка обработки callback query:', error);
        if (this.bot) {
          await this.bot.answerCallbackQuery(query.id, {
            text: 'Произошла ошибка. Попробуйте позже.',
            show_alert: true
          });
        }
      }
    });

    // Обработчик текстовых сообщений для ввода количества
    this.bot.on('message', async (msg: Message) => {
      try {
        if (!msg.text || msg.text.startsWith('/') || !msg.from) return;

        // Проверяем, ожидается ли ввод количества от этого пользователя
        const pendingInput = await this.checkPendingQuantityInput(msg.from.id.toString());
        if (pendingInput) {
          await this.handleQuantityInput(msg, pendingInput);
        }
      } catch (error) {
        console.error('Ошибка обработки текстового сообщения:', error);
      }
    });
  }

  /**
   * Запускает задачу очистки просроченных состояний
   */
  private startCleanupTask() {
    // Очищаем просроченные состояния каждые 5 минут
    setInterval(async () => {
      try {
        await prisma.telegramUserState.deleteMany({
          where: {
            expiresAt: {
              lte: new Date()
            }
          }
        });
      } catch (error) {
        console.error('Ошибка очистки просроченных состояний:', error);
      }
    }, 5 * 60 * 1000); // 5 минут
  }

  /**
   * Отправляет уведомления продавцам о новом заказе
   */
  async sendNewOrderNotifications(orderId: number) {
    try {
      // Получаем информацию о заказе и товарах
      const order = await prisma.order.findUnique({
        where: { id: orderId },
        include: {
          user: {
            select: { name: true, telegram_user_id: true, phone_number: true }
          },
          items: {
            include: {
              product: {
                select: { 
                  id: true, 
                  name: true, 
                  price: true, 
                  image: true,
                  storeId: true,
                  store: {
                    select: { 
                      id: true, 
                      name: true
                    }
                  }
                }
              }
            }
          }
        }
      });

      if (!order) {
        throw new AppError('Заказ не найден', 404);
      }

      // Получаем уникальные ID магазинов из заказа
      const storeIds = [...new Set(order.items.map(item => item.product.storeId))];
      console.log('🏪 Магазины в заказе:', storeIds);

      // Находим всех продавцов (SELLER) для этих магазинов
      const sellers = await prisma.user.findMany({
        where: {
          role: 'SELLER',
          ownedStore: {
            id: { in: storeIds }
          }
        },
        include: {
          ownedStore: {
            select: {
              id: true,
              name: true
            }
          }
        }
      });

      console.log('👥 Найдены продавцы:', sellers.map(s => ({
        id: s.id,
        name: s.name,
        role: s.role,
        storeId: s.ownedStore?.id,
        storeName: s.ownedStore?.name,
        telegram: s.telegram_user_id
      })));

      // Находим всех администраторов (ADMIN)
      const admins = await prisma.user.findMany({
        where: { role: 'ADMIN' },
        select: { telegram_user_id: true }
      });
      console.log('👥 Найдены администраторы:', admins.map(a => a.telegram_user_id));

      await Promise.all(
        admins.map(admin => {
          if (admin.telegram_user_id) {
            this.sendAdminOrderNotification(order, "", order.items, admin.telegram_user_id);
            console.log(`📤 Отправляем уведомление админу ${admin.telegram_user_id} для заказа ${order.id}`) ;
            return this.bot?.sendMessage(admin.telegram_user_id, `Создан новый заказ с ID: ${order.id}`);
          }
        })
      );




      console.log('👥 Найдены администраторы:', admins.map(a => a.telegram_user_id));

      // Группируем товары по магазинам
      const storeGroups = new Map<number, any[]>();
      
      for (const item of order.items) {
        const storeId = item.product.storeId;
        if (!storeGroups.has(storeId)) {
          storeGroups.set(storeId, []);
        }
        storeGroups.get(storeId)!.push(item);
      }

      // Отправляем уведомления каждому продавцу только для его магазина
      const notifications = sellers.map(async (seller) => {
        if (!seller.telegram_user_id || !seller.ownedStore) {
          console.warn(`Продавец ${seller.name} (ID: ${seller.id}) не имеет Telegram ID или магазина`);
          return;
        }

        const storeId = seller.ownedStore.id;
        const itemsForStore = storeGroups.get(storeId);
        
        if (!itemsForStore || itemsForStore.length === 0) {
          console.warn(`Нет товаров для магазина ${seller.ownedStore.name} (ID: ${storeId})`);
          return;
        }

        console.log(`📤 Отправляем уведомление продавцу ${seller.name} для магазина ${seller.ownedStore.name}`);
        
        return this.sendStoreOrderNotification(order, seller.ownedStore, itemsForStore, seller.telegram_user_id);
      });

      await Promise.all(notifications.filter(Boolean));
      console.log(`✅ Отправлены уведомления для заказа #${orderId}`);
      
      // Отправляем уведомления администраторам
      
      
    } catch (error) {
      console.error('Ошибка отправки уведомлений о заказе:', error);
      throw error;
    }
  }

  /**
   * Отправляет уведомление конкретному продавцу
   */
  private async sendStoreOrderNotification(
    order: any, 
    store: any, 
    items: any[], 
    telegramUserId: string
  ) {
    if (!this.bot) return;

    try {
      const customerName = order.user.name || 'Неизвестный покупатель';
      const customerPhone = order.user.phone_number || 'Не указан';
      
      // Формируем текст сообщения
      let message = `🛒 *Новый заказ #${order.id}*\n\n`;
      message += `🏪 *Магазин:* ${store.name}\n`;
      message += `👤 *Покупатель:* ${customerName}\n`;
      message += `📞 *Телефон:* ${customerPhone}\n`;
      message += `📍 *Адрес доставки:* ${order.address}\n\n`;
      message += `📦 *Товары для подтверждения:*\n`;

      let totalAmount = 0;
      items.forEach((item, index) => {
        const itemTotal = item.quantity * item.price;
        totalAmount += itemTotal;
        message += `${index + 1}. ${item.product.name}\n`;
        message += `   Количество: ${item.quantity} шт.\n`;
        message += `   Цена: ${item.price} ₸/шт.\n`;
        message += `   Сумма: ${itemTotal} ₸\n\n`;
      });

      message += `💰 *Итого по вашему магазину:* ${totalAmount} ₸\n\n`;
      message += `⚡ *Требуется подтверждение наличия товаров!*`;

      // Создаем inline клавиатуру для каждого товара
      const keyboard = [];
      
      for (const item of items) {
        // Получаем ID подтверждения для этого товара
        const confirmation = await prisma.storeOrderConfirmation.findFirst({
          where: {
            orderItem: {
              orderId: order.id,
              productId: item.productId
            },
            storeId: store.id
          }
        });

        if (confirmation) {
          const confirmedData = `confirm_item:${confirmation.id}:CONFIRMED:${item.quantity}`;
          const partialData = `confirm_item:${confirmation.id}:PARTIAL:0`;
          const rejectedData = `confirm_item:${confirmation.id}:REJECTED:0`;
          
          console.log('🎯 Создаем кнопки для товара:', {
            productName: item.product.name,
            confirmationId: confirmation.id,
            confirmedData,
            partialData,
            rejectedData,
            confirmedDataLength: confirmedData.length,
            partialDataLength: partialData.length,
            rejectedDataLength: rejectedData.length
          });
          
          keyboard.push([
            {
              text: `✅ ${item.product.name} - В наличии`,
              callback_data: confirmedData
            }
          ]);
          keyboard.push([
            {
              text: `⚠️ ${item.product.name} - Частично`,
              callback_data: partialData
            },
            {
              text: `❌ ${item.product.name} - Нет в наличии`,
              callback_data: rejectedData
            }
          ]);
        } else {
          console.warn('❌ Не найдено подтверждение для товара:', {
            orderId: order.id,
            productId: item.productId,
            storeId: store.id
          });
        }
      }

      console.log('📤 Отправляем сообщение продавцу:', {
        telegramUserId,
        storeName: store.name,
        keyboardRows: keyboard.length,
        totalButtons: keyboard.reduce((sum, row) => sum + row.length, 0)
      });

      // Отправляем сообщение
      await this.bot.sendMessage(telegramUserId, message, {
        parse_mode: 'Markdown',
        reply_markup: {
          inline_keyboard: keyboard
        }
      });

      console.log(`📱 Уведомление отправлено продавцу ${store.name} (${telegramUserId})`);
      
    } catch (error) {
      console.error(`Ошибка отправки уведомления продавцу ${telegramUserId}:`, error);
      throw error;
    }
  }

  /**
   * Обрабатывает подтверждение товара продавцом
   */
  private async handleItemConfirmation(
    confirmationId: number,
    status: 'CONFIRMED' | 'PARTIAL' | 'REJECTED',
    quantity: number = 0,
    query: CallbackQuery
  ) {
    if (!this.bot) return;

    console.log('🔄 Обработка подтверждения товара:', {
      confirmationId,
      status,
      quantity,
      from: query.from?.username || query.from?.id
    });

    try {
      const confirmation = await prisma.storeOrderConfirmation.findUnique({
        where: { id: confirmationId },
        include: {
          orderItem: {
            include: {
              product: { select: { name: true } },
              order: { select: { id: true } }
            }
          },
          store: {
            include: {
              owner: { select: { id: true } }
            }
          }
        }
      });

      if (!confirmation) {
        console.log('❌ Подтверждение не найдено:', confirmationId);
        await this.bot.answerCallbackQuery(query.id, {
          text: 'Подтверждение не найдено',
          show_alert: true
        });
        return;
      }

      console.log('📦 Найдено подтверждение:', {
        id: confirmation.id,
        status: confirmation.status,
        productName: confirmation.orderItem.product.name,
        orderId: confirmation.orderItem.order.id
      });

      if (confirmation.status !== 'PENDING') {
        console.log('⚠️ Товар уже подтвержден со статусом:', confirmation.status);
        await this.bot.answerCallbackQuery(query.id, {
          text: 'Этот товар уже подтвержден',
          show_alert: true
        });
        return;
      }

      // Если частичное подтверждение, запрашиваем количество
      if (status === 'PARTIAL') {
        console.log('❓ Запрашиваем количество для частичного подтверждения');
        await this.requestQuantityInput(
          query.from.id.toString(),
          confirmationId,
          confirmation.orderItem.product.name,
          confirmation.orderItem.quantity
        );
        await this.bot.answerCallbackQuery(query.id, {
          text: 'Укажите доступное количество'
        });
        return;
      }

      // Обновляем подтверждение
      const finalQuantity = status === 'REJECTED' ? 0 : quantity;
      
      console.log('💾 Обновляем подтверждение в БД:', {
        status,
        finalQuantity,
        confirmedById: confirmation.store.owner?.id
      });

      await prisma.storeOrderConfirmation.update({
        where: { id: confirmationId },
        data: {
          status,
          confirmedQuantity: finalQuantity,
          confirmedAt: new Date(),
          confirmedById: confirmation.store.owner!.id
        }
      });

      const statusText = {
        'CONFIRMED': '✅ подтвержден',
        'REJECTED': '❌ отклонен',
        'PARTIAL': '⚠️ частично подтвержден'
      };

      console.log('✅ Подтверждение успешно обновлено');

      await this.bot.answerCallbackQuery(query.id, {
        text: `Товар "${confirmation.orderItem.product.name}" ${statusText[status]}`
      });

      // Обновляем сообщение
      await this.updateOrderMessage(query.message, confirmation.orderItem.order.id);

    } catch (error) {
      console.error('Ошибка подтверждения товара:', error);
      if (this.bot) {
        await this.bot.answerCallbackQuery(query.id, {
          text: 'Произошла ошибка',
          show_alert: true
        });
      }
    }
  }

  /**
   * Запрашивает ввод количества для частичного подтверждения
   */
  private async requestQuantityInput(
    telegramUserId: string,
    confirmationId: number,
    productName: string,
    maxQuantity: number
  ) {
    if (!this.bot) return;

    try {
      // Сохраняем состояние ожидания ввода
      const expiresAt = new Date();
      expiresAt.setMinutes(expiresAt.getMinutes() + 10); // Состояние действует 10 минут

      await prisma.telegramUserState.upsert({
        where: { telegram_user_id: telegramUserId },
        update: {
          state: 'waiting_quantity_input',
          data: {
            confirmationId,
            productName,
            maxQuantity
          },
          expiresAt
        },
        create: {
          telegram_user_id: telegramUserId,
          state: 'waiting_quantity_input',
          data: {
            confirmationId,
            productName,
            maxQuantity
          },
          expiresAt
        }
      });

      const message = `Укажите доступное количество товара "${productName}"\n` +
                     `Заказано: ${maxQuantity} шт.\n` +
                     `Введите число от 1 до ${maxQuantity - 1}:`;

      await this.bot.sendMessage(telegramUserId, message, {
        reply_markup: {
          force_reply: true,
          selective: true
        }
      });
    } catch (error) {
      console.error('Ошибка запроса количества:', error);
    }
  }

  /**
   * Проверяет, ожидается ли ввод количества от пользователя
   */
  private async checkPendingQuantityInput(telegramUserId: string): Promise<PendingQuantityInput | null> {
    try {
      const userState = await prisma.telegramUserState.findUnique({
        where: { telegram_user_id: telegramUserId }
      });

      if (!userState || userState.expiresAt < new Date()) {
        return null;
      }

      if (userState.state === 'waiting_quantity_input' && userState.data) {
        const data = userState.data as any;
        return {
          confirmationId: data.confirmationId,
          productName: data.productName,
          maxQuantity: data.maxQuantity
        };
      }

      return null;
    } catch (error) {
      console.error('Ошибка проверки состояния пользователя:', error);
      return null;
    }
  }

  /**
   * Обрабатывает ввод количества пользователем
   */
  private async handleQuantityInput(message: Message, pendingInput: PendingQuantityInput) {
    if (!this.bot || !message.from) return;

    try {
      const quantity = parseInt(message.text || '');
      
      if (isNaN(quantity) || quantity < 1 || quantity >= pendingInput.maxQuantity) {
        await this.bot.sendMessage(message.from.id, 
          `❌ Неверное количество. Введите число от 1 до ${pendingInput.maxQuantity - 1}`
        );
        return;
      }

      // Обновляем подтверждение
      const confirmation = await prisma.storeOrderConfirmation.findUnique({
        where: { id: pendingInput.confirmationId },
        include: {
          store: {
            include: { owner: { select: { id: true } } }
          },
          orderItem: {
            select: { orderId: true }
          }
        }
      });

      if (!confirmation || !confirmation.store.owner) {
        await this.bot.sendMessage(message.from.id, '❌ Ошибка: подтверждение не найдено');
        return;
      }

      await prisma.storeOrderConfirmation.update({
        where: { id: pendingInput.confirmationId },
        data: {
          status: 'PARTIAL',
          confirmedQuantity: quantity,
          confirmedAt: new Date(),
          confirmedById: confirmation.store.owner.id
        }
      });

      // Удаляем состояние ожидания
      await prisma.telegramUserState.delete({
        where: { telegram_user_id: message.from.id.toString() }
      });

      await this.bot.sendMessage(message.from.id, 
        `✅ Подтверждено частичное наличие товара "${pendingInput.productName}": ${quantity} шт.`
      );

      // Обновляем исходное сообщение с заказом (находим его через историю сообщений)
      // Поскольку у нас нет прямой ссылки на сообщение, отправляем новое обновленное уведомление
      try {
        await this.sendOrderStatusSummary(confirmation.orderItem.orderId, message.from.id.toString());
      } catch (error) {
        console.error('Ошибка отправки обновленного статуса заказа:', error);
      }

    } catch (error) {
      console.error('Ошибка обработки ввода количества:', error);
      if (this.bot) {
        await this.bot.sendMessage(message.from.id, '❌ Произошла ошибка при обработке');
      }
    }
  }

  /**
   * Обновляет сообщение с информацией о заказе
   */
  private async updateOrderMessage(message: any, orderId: number) {
    if (!this.bot) return;

    try {
      // Получаем актуальную информацию о заказе и подтверждениях
      const order = await prisma.order.findUnique({
        where: { id: orderId },
        include: {
          user: {
            select: { name: true, telegram_user_id: true, phone_number: true }
          },
          items: {
            include: {
              product: {
                select: { 
                  id: true, 
                  name: true, 
                  price: true, 
                  image: true,
                  store: {
                    select: { 
                      id: true, 
                      name: true
                    }
                  }
                }
              }
            }
          }
        }
      });

      if (!order) {
        console.error('Заказ не найден при обновлении сообщения:', orderId);
        return;
      }

      // Получаем подтверждения отдельно
      const confirmations = await prisma.storeOrderConfirmation.findMany({
        where: {
          orderItem: { orderId }
        },
        include: {
          orderItem: {
            select: { id: true, productId: true }
          }
        }
      });

      // Создаем мапу подтверждений по productId
      const confirmationMap = new Map();
      confirmations.forEach(conf => {
        confirmationMap.set(conf.orderItem.productId, conf);
      });

      // Получаем магазин из первого товара (все товары в уведомлении из одного магазина)
      const store = order.items[0]?.product.store;
      if (!store) {
        console.error('Магазин не найден для заказа:', orderId);
        return;
      }

      const customerName = order.user.name || 'Неизвестный покупатель';
      const customerPhone = order.user.phone_number || 'Не указан';
      
      // Формируем обновленный текст сообщения
      let updateText = `🛒 *Новый заказ #${order.id}*\n\n`;
      updateText += `🏪 *Магазин:* ${store.name}\n`;
      updateText += `👤 *Покупатель:* ${customerName}\n`;
      updateText += `📞 *Телефон:* ${customerPhone}\n`;
      updateText += `📍 *Адрес доставки:* ${order.address}\n\n`;
      updateText += `📦 *Товары:*\n`;

      let totalAmount = 0;
      const pendingItems: Array<{ item: any, confirmationId: number }> = [];

      order.items.forEach((item: any, index: number) => {
        const itemTotal = item.quantity * item.price;
        totalAmount += itemTotal;
        
        updateText += `${index + 1}. ${item.product.name}\n`;
        updateText += `   Количество: ${item.quantity} шт.\n`;
        updateText += `   Цена: ${item.price} ₸/шт.\n`;
        updateText += `   Сумма: ${itemTotal} ₸\n`;
        
        // Получаем подтверждение для этого товара
        const confirmation = confirmationMap.get(item.productId);
        
        if (confirmation) {
          const statusEmoji = {
            'PENDING': '⏳ Ожидает подтверждения',
            'CONFIRMED': '✅ Подтверждено',
            'PARTIAL': `⚠️ Частично (${confirmation.confirmedQuantity} шт.)`,
            'REJECTED': '❌ Отклонено'
          };
          updateText += `   Статус: ${statusEmoji[confirmation.status as keyof typeof statusEmoji]}\n`;
          
          // Добавляем в список ожидающих, если статус PENDING
          if (confirmation.status === 'PENDING') {
            pendingItems.push({
              item,
              confirmationId: confirmation.id
            });
          }
        } else {
          updateText += `   Статус: ⏳ Ожидает подтверждения\n`;
        }
        updateText += '\n';
      });

      updateText += `💰 *Итого по вашему магазину:* ${totalAmount} ₸\n\n`;

      // Создаем клавиатуру только для неподтвержденных товаров
      const keyboard: any[] = [];
      
      if (pendingItems.length > 0) {
        updateText += `⚡ *Требуется подтверждение наличия товаров!*`;
        
        pendingItems.forEach(({ item, confirmationId }) => {
          console.log('🎯 Создаем кнопки для неподтвержденного товара:', {
            productName: item.product.name,
            confirmationId,
            quantity: item.quantity
          });
          
          keyboard.push([
            {
              text: `✅ ${item.product.name} - В наличии`,
              callback_data: `confirm_item:${confirmationId}:CONFIRMED:${item.quantity}`
            }
          ]);
          keyboard.push([
            {
              text: `⚠️ ${item.product.name} - Частично`,
              callback_data: `confirm_item:${confirmationId}:PARTIAL:0`
            },
            {
              text: `❌ ${item.product.name} - Нет в наличии`,
              callback_data: `confirm_item:${confirmationId}:REJECTED:0`
            }
          ]);
        });
      } else {
        updateText += `✅ *Все товары подтверждены!*`;
      }

      console.log('📝 Обновляем сообщение:', {
        orderId,
        pendingItemsCount: pendingItems.length,
        keyboardRows: keyboard.length
      });

      // Обновляем сообщение с новым текстом и клавиатурой
      await this.bot.editMessageText(updateText, {
        chat_id: message.chat.id,
        message_id: message.message_id,
        parse_mode: 'Markdown',
        reply_markup: {
          inline_keyboard: keyboard
        }
      });

    } catch (error) {
      console.error('Ошибка обновления сообщения:', error);
    }
  }

  /**
   * Отправляет уведомление о статусе заказа
   */
  async sendOrderStatusUpdate(orderId: number, newStatus: string) {
    if (!this.bot) return;

    try {
      const order = await prisma.order.findUnique({
        where: { id: orderId },
        include: {
          user: { select: { telegram_user_id: true, name: true } }
        }
      });

      if (!order || !order.user.telegram_user_id) return;

      const statusMessages = {
        'WAITING_PAYMENT': '💳 Ожидает оплаты',
        'PREPARING': '📦 Готовится к отправке',
        'DELIVERING': '🚚 В пути',
        'DELIVERED': '✅ Доставлен',
        'CANCELLED': '❌ Отменен'
      };

      const message = `🔔 Статус заказа #${orderId} изменен\n\n` +
                     `${statusMessages[newStatus as keyof typeof statusMessages] || newStatus}`;

      await this.bot.sendMessage(order.user.telegram_user_id, message);

    } catch (error) {
      console.error('Ошибка отправки уведомления о статусе:', error);
    }
  }

  /**
   * Отправляет краткую сводку о текущем статусе подтверждений по заказу
   */
  private async sendOrderStatusSummary(orderId: number, telegramUserId: string) {
    if (!this.bot) return;

    try {
      // Получаем информацию о подтверждениях
      const confirmations = await prisma.storeOrderConfirmation.findMany({
        where: {
          orderItem: { orderId }
        },
        include: {
          orderItem: {
            include: {
              product: { select: { name: true } }
            }
          }
        }
      });

      let summaryText = `📋 *Статус подтверждений по заказу #${orderId}:*\n\n`;
      
      let hasPending = false;
      confirmations.forEach(conf => {
        const statusEmoji = {
          'PENDING': '⏳',
          'CONFIRMED': '✅',
          'PARTIAL': '⚠️',
          'REJECTED': '❌'
        };
        
        summaryText += `${statusEmoji[conf.status as keyof typeof statusEmoji]} ${conf.orderItem.product.name}`;
        if (conf.status === 'PARTIAL') {
          summaryText += ` (${conf.confirmedQuantity} шт.)`;
        }
        summaryText += '\n';
        
        if (conf.status === 'PENDING') {
          hasPending = true;
        }
      });

      if (hasPending) {
        summaryText += '\n⚡ Некоторые товары еще ожидают подтверждения.';
      } else {
        summaryText += '\n✅ Все товары обработаны!';
      }

      await this.bot.sendMessage(telegramUserId, summaryText, {
        parse_mode: 'Markdown'
      });

    } catch (error) {
      console.error('Ошибка отправки сводки статуса заказа:', error);
    }
  }

  /**
   * Отправляет уведомление курьеру о назначении заказа
   */
  async sendCourierAssignmentNotification(orderId: number, courierId: number) {
    if (!this.bot) return;

    try {
      // Получаем информацию о заказе и курьере
      const order = await prisma.order.findUnique({
        where: { id: orderId },
        include: {
          user: {
            select: { name: true, phone_number: true }
          },
          items: {
            include: {
              product: {
                select: { name: true, price: true }
              }
            }
          },
          courier: {
            select: { telegram_user_id: true, name: true }
          }
        }
      });

      if (!order || !order.courier?.telegram_user_id) {
        console.warn('Заказ или курьер не найден для отправки уведомления:', { orderId, courierId });
        return;
      }

      const customerName = order.user.name || 'Неизвестный покупатель';
      const customerPhone = order.user.phone_number || 'Не указан';
      const totalAmount = order.items.reduce((sum, item) => sum + (item.quantity * (item.price || 0)), 0);

      // Формируем информацию о доставке
      let deliveryInfo = '';
      if (order.deliveryType === 'SCHEDULED' && order.scheduledDate) {
        const deliveryDate = new Date(order.scheduledDate);
        const formattedDate = deliveryDate.toLocaleDateString('ru-RU', {
          day: '2-digit',
          month: '2-digit',
          year: 'numeric'
        });
        const formattedTime = deliveryDate.toLocaleTimeString('ru-RU', {
          hour: '2-digit',
          minute: '2-digit'
        });
        deliveryInfo = `⏰ *Запланированная доставка:* ${formattedDate} в ${formattedTime}\n`;
      } else {
        deliveryInfo = `🚀 *Тип доставки:* Как можно быстрее\n`;
      }

      // Формируем текст уведомления
      let message = `🚚 *Вам назначен новый заказ #${order.id}*\n\n`;
      message += `👤 *Покупатель:* ${customerName}\n`;
      message += `📞 *Телефон:* ${customerPhone}\n`;
      message += `📍 *Адрес доставки:* ${order.address}\n`;
      message += deliveryInfo;
      message += `\n📦 *Товары для доставки:*\n`;

      order.items.forEach((item, index) => {
        const itemTotal = item.quantity * (item.price || 0);
        message += `${index + 1}. ${item.product.name}\n`;
        message += `   Количество: ${item.quantity} шт.\n`;
        message += `   Цена: ${item.price || 0} ₸/шт.\n`;
        message += `   Сумма: ${itemTotal} ₸\n\n`;
      });

      message += `💰 *Общая сумма заказа:* ${totalAmount} ₸\n\n`;
      message += `🚀 *Статус:* Готов к доставке\n`;
      message += `📱 Когда доставите заказ, нажмите кнопку ниже`;

      // Создаем кнопку для подтверждения доставки
      const keyboard = [
        [
          {
            text: '✅ Заказ доставлен',
            callback_data: `courier_delivered:${orderId}:${courierId}`
          }
        ]
      ];

      console.log('📤 Отправляем уведомление курьеру:', {
        courierId,
        courierTelegram: order.courier.telegram_user_id,
        orderId,
        totalAmount
      });

      // Отправляем уведомление
      await this.bot.sendMessage(order.courier.telegram_user_id, message, {
        parse_mode: 'Markdown',
        reply_markup: {
          inline_keyboard: keyboard
        }
      });

      console.log(`📱 Уведомление о назначении заказа #${orderId} отправлено курьеру ${order.courier.name || courierId}`);

    } catch (error) {
      console.error('Ошибка отправки уведомления курьеру:', error);
      throw error;
    }
  }

  /**
   * Обрабатывает подтверждение доставки от курьера
   */
  private async handleCourierDelivery(orderId: number, courierId: number, query: CallbackQuery) {
    if (!this.bot) return;

    console.log('🚚 Обработка подтверждения доставки:', {
      orderId,
      courierId,
      from: query.from?.username || query.from?.id
    });

    try {
      // Проверяем, что заказ назначен этому курьеру
      const order = await prisma.order.findUnique({
        where: { id: orderId },
        select: { 
          id: true, 
          courierId: true,
          statuses: {
            orderBy: { createdAt: 'desc' },
            take: 1,
            select: { status: true }
          }
        }
      });

      if (!order) {
        await this.bot.answerCallbackQuery(query.id, {
          text: 'Заказ не найден',
          show_alert: true
        });
        return;
      }

      if (order.courierId !== courierId) {
        await this.bot.answerCallbackQuery(query.id, {
          text: 'Этот заказ не назначен вам',
          show_alert: true
        });
        return;
      }

      const currentStatus = order.statuses[0]?.status;
      if (currentStatus === 'DELIVERED') {
        await this.bot.answerCallbackQuery(query.id, {
          text: 'Заказ уже отмечен как доставленный',
          show_alert: true
        });
        return;
      }

      if (currentStatus !== 'DELIVERING') {
        await this.bot.answerCallbackQuery(query.id, {
          text: 'Можно отметить доставленным только заказ в статусе "В пути"',
          show_alert: true
        });
        return;
      }

      // Обновляем статус заказа на DELIVERED
      await prisma.orderStatus.create({
        data: {
          orderId,
          status: 'DELIVERED'
        }
      });

      console.log(`✅ Заказ #${orderId} отмечен курьером ${courierId} как доставленный`);

      await this.bot.answerCallbackQuery(query.id, {
        text: '✅ Заказ отмечен как доставленный!'
      });

      // Обновляем сообщение, убирая кнопку
      if (query.message) {
        const updatedText = query.message.text + '\n\n✅ *Заказ доставлен!*';
        
        await this.bot.editMessageText(updatedText, {
          chat_id: query.message.chat.id,
          message_id: query.message.message_id,
          parse_mode: 'Markdown'
        });
      }

      // Отправляем запрос на оценку клиенту
      await this.sendRatingRequest(orderId);

      // Отправляем уведомление покупателю о доставке
      await this.sendOrderStatusUpdate(orderId, 'DELIVERED');

    } catch (error) {
      console.error('Ошибка обработки подтверждения доставки:', error);
      if (this.bot) {
        await this.bot.answerCallbackQuery(query.id, {
          text: 'Произошла ошибка',
          show_alert: true
        });
      }
    }
  }

  // Отправка запроса на оценку доставки клиенту
  async sendRatingRequest(orderId: number): Promise<void> {
    try {
      if (!this.bot) {
        console.error('❌ Telegram bot не инициализирован');
        return;
      }

      console.log(`📊 Отправляем запрос на оценку доставки для заказа #${orderId}`);

      const order = await prisma.order.findUnique({
        where: { id: orderId },
        include: {
          user: {
            select: { telegram_user_id: true, name: true }
          },
          courier: {
            select: { name: true }
          },
          items: {
            include: {
              product: {
                select: { name: true }
              }
            }
          },
          deliveryRating: true
        }
      });

      if (!order) {
        console.error(`❌ Заказ #${orderId} не найден для отправки запроса на оценку`);
        return;
      }

      if (order.deliveryRating) {
        console.log(`ℹ️ Оценка для заказа #${orderId} уже поставлена`);
        return;
      }

      if (!order.user.telegram_user_id) {
        console.log(`ℹ️ У пользователя заказа #${orderId} нет Telegram ID`);
        return;
      }

      const courierName = order.courier?.name || 'Курьер';
      const totalAmount = order.items.reduce((sum, item) => sum + (item.quantity * (item.price || 0)), 0);

      let message = `🎉 *Ваш заказ #${orderId} доставлен!*\n\n`;
      message += `👤 *Курьер:* ${courierName}\n`;
      message += `💰 *Сумма заказа:* ${totalAmount} ₸\n\n`;
      message += `📊 *Пожалуйста, оцените качество доставки:*\n`;
      message += `• Качество товаров\n`;
      message += `• Скорость доставки\n`;
      message += `• Общее впечатление\n\n`;
      message += `Ваше мнение поможет нам улучшить сервис! ⭐`;

      const keyboard = [
        [
          {
            text: '⭐ Оценить доставку',
            callback_data: `rate_delivery:${orderId}`
          }
        ]
      ];

      await this.bot.sendMessage(order.user.telegram_user_id, message, {
        parse_mode: 'Markdown',
        reply_markup: {
          inline_keyboard: keyboard
        }
      });

      console.log(`📱 Запрос на оценку доставки отправлен клиенту для заказа #${orderId}`);
    } catch (error) {
      console.error('Ошибка отправки запроса на оценку:', error);
    }
  }

  // Обработка начала процесса оценки
  async handleRatingStart(query: any, orderId: number): Promise<void> {
    try {
      if (!this.bot) {
        console.error('❌ Telegram bot не инициализирован');
        return;
      }

      const userId = query.from.id.toString();

      // Проверяем права доступа к заказу
      const order = await prisma.order.findUnique({
        where: { id: orderId },
        include: {
          user: { select: { telegram_user_id: true } },
          deliveryRating: true
        }
      });

      if (!order) {
        await this.bot.answerCallbackQuery(query.id, {
          text: 'Заказ не найден',
          show_alert: true
        });
        return;
      }

      if (order.user.telegram_user_id !== userId) {
        await this.bot.answerCallbackQuery(query.id, {
          text: 'Вы можете оценить только свои заказы',
          show_alert: true
        });
        return;
      }

      if (order.deliveryRating) {
        await this.bot.answerCallbackQuery(query.id, {
          text: 'Вы уже оценили этот заказ',
          show_alert: true
        });
        return;
      }

      await this.bot.answerCallbackQuery(query.id, {
        text: 'Начинаем оценку доставки...'
      });

      // Отправляем первый вопрос - качество
      await this.sendQualityRating(userId, orderId);

    } catch (error) {
      console.error('Ошибка начала оценки:', error);
      if (this.bot) {
        await this.bot.answerCallbackQuery(query.id, {
          text: 'Произошла ошибка',
          show_alert: true
        });
      }
    }
  }

  // Отправка оценки качества
  async sendQualityRating(chatId: string, orderId: number): Promise<void> {
    if (!this.bot) {
      console.error('❌ Telegram bot не инициализирован');
      return;
    }

    const message = `📦 *Оценка качества товаров*\n\nОцените качество полученных товаров от 1 до 5:`;
    
    const keyboard = [];
    for (let i = 1; i <= 5; i++) {
      keyboard.push([{
        text: `${i} ${'⭐'.repeat(i)}`,
        callback_data: `quality_rating:${orderId}:${i}`
      }]);
    }

    await this.bot.sendMessage(chatId, message, {
      parse_mode: 'Markdown',
      reply_markup: {
        inline_keyboard: keyboard
      }
    });
  }

  // Отправка оценки скорости
  async sendSpeedRating(chatId: string, orderId: number, quality: number): Promise<void> {
    if (!this.bot) {
      console.error('❌ Telegram bot не инициализирован');
      return;
    }

    const message = `🚀 *Оценка скорости доставки*\n\nОцените скорость доставки от 1 до 5:`;
    
    const keyboard = [];
    for (let i = 1; i <= 5; i++) {
      keyboard.push([{
        text: `${i} ${'⭐'.repeat(i)}`,
        callback_data: `speed_rating:${orderId}:${quality}:${i}`
      }]);
    }

    await this.bot.sendMessage(chatId, message, {
      parse_mode: 'Markdown',
      reply_markup: {
        inline_keyboard: keyboard
      }
    });
  }

  // Отправка общей оценки впечатления
  async sendImpressionRating(chatId: string, orderId: number, quality: number, speed: number): Promise<void> {
    if (!this.bot) {
      console.error('❌ Telegram bot не инициализирован');
      return;
    }

    const message = `💝 *Общее впечатление*\n\nОцените ваше общее впечатление от доставки от 1 до 5:`;
    
    const keyboard = [];
    for (let i = 1; i <= 5; i++) {
      keyboard.push([{
        text: `${i} ${'⭐'.repeat(i)}`,
        callback_data: `impression_rating:${orderId}:${quality}:${speed}:${i}`
      }]);
    }

    await this.bot.sendMessage(chatId, message, {
      parse_mode: 'Markdown',
      reply_markup: {
        inline_keyboard: keyboard
      }
    });
  }

  // Финализация оценки
  async finalizeRating(chatId: string, orderId: number, quality: number, speed: number, impression: number): Promise<void> {
    try {
      if (!this.bot) {
        console.error('❌ Telegram bot не инициализирован');
        return;
      }

      // Получаем информацию о заказе для создания оценки
      const order = await prisma.order.findUnique({
        where: { id: orderId },
        include: {
          user: { select: { id: true } }
        }
      });

      if (!order) {
        await this.bot.sendMessage(chatId, '❌ Заказ не найден.');
        return;
      }

      // Создаем оценку в базе данных
      await prisma.deliveryRating.create({
        data: {
          orderId,
          userId: order.user.id,
          courierId: order.courierId,
          quality,
          speed,
          impression
        }
      });

      const avgRating = ((quality + speed + impression) / 3).toFixed(1);
      
      let message = `🎉 *Спасибо за оценку!*\n\n`;
      message += `📊 *Ваши оценки:*\n`;
      message += `📦 Качество: ${quality} ${'⭐'.repeat(quality)}\n`;
      message += `🚀 Скорость: ${speed} ${'⭐'.repeat(speed)}\n`;
      message += `💝 Впечатление: ${impression} ${'⭐'.repeat(impression)}\n\n`;
      message += `⭐ *Средняя оценка: ${avgRating}/5*\n\n`;
      message += `Ваше мнение поможет нам стать лучше! 💙`;

      await this.bot.sendMessage(chatId, message, {
        parse_mode: 'Markdown'
      });

      console.log(`✅ Оценка доставки сохранена для заказа #${orderId}: качество ${quality}, скорость ${speed}, впечатление ${impression}`);
    } catch (error) {
      console.error('Ошибка сохранения оценки:', error);
      if (this.bot) {
        await this.bot.sendMessage(chatId, '❌ Произошла ошибка при сохранении оценки.');
      }
    }
  }

  // Отправка уведомления клиенту о смене статуса заказа
  async sendOrderStatusNotification(orderId: number, status: string): Promise<void> {
    try {
      if (!this.bot) {
        console.error('❌ Telegram bot не инициализирован');
        return;
      }

      console.log(`📢 Отправляем уведомление о смене статуса заказа #${orderId} на ${status}`);

      const order = await prisma.order.findUnique({
        where: { id: orderId },
        include: {
          user: {
            select: { telegram_user_id: true, name: true }
          },
          items: {
            include: {
              product: {
                select: { name: true }
              }
            }
          },
          courier: {
            select: { name: true }
          }
        }
      });

      if (!order) {
        console.error(`❌ Заказ #${orderId} не найден для отправки уведомления`);
        return;
      }

      if (!order.user.telegram_user_id) {
        console.log(`ℹ️ У пользователя заказа #${orderId} нет Telegram ID`);
        return;
      }

      const statusMessages = {
        'NEW': '🆕 Новый заказ',
        'WAITING_PAYMENT': '💳 Ожидает оплаты',
        'PREPARING': '👨‍🍳 Готовится',
        'DELIVERING': '🚚 В пути',
        'DELIVERED': '✅ Доставлен',
        'CANCELLED': '❌ Отменен'
      };

      const statusEmoji = {
        'NEW': '🆕',
        'WAITING_PAYMENT': '💳',
        'PREPARING': '👨‍🍳',
        'DELIVERING': '🚚',
        'DELIVERED': '✅',
        'CANCELLED': '❌'
      };

      const statusText = statusMessages[status as keyof typeof statusMessages] || status;
      const emoji = statusEmoji[status as keyof typeof statusEmoji] || '📋';

      let message = `${emoji} *Статус заказа #${orderId} изменен*\n\n`;
      message += `📊 *Новый статус:* ${statusText}\n`;
      
      // Информация о товарах
      if (order.items.length > 0) {
        message += `\n🛒 *Товары:*\n`;
        order.items.forEach(item => {
          message += `• ${item.product.name} x${item.quantity}\n`;
        });
      }

      // Общая сумма
      const totalAmount = order.items.reduce((sum, item) => sum + (item.quantity * (item.price || 0)), 0);
      message += `\n💰 *Сумма заказа:* ${totalAmount} ₸`;

      // Дополнительная информация в зависимости от статуса
      if (status === 'DELIVERING' && order.courier) {
        message += `\n\n🚚 *Курьер:* ${order.courier.name}`;
        message += `\n📍 *Адрес доставки:* ${order.address}`;
        
        if (order.deliveryType === 'SCHEDULED' && order.scheduledDate) {
          const deliveryTime = new Date(order.scheduledDate).toLocaleString('ru-RU', {
            timeZone: 'Asia/Almaty',
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit'
          });
          message += `\n⏰ *Время доставки:* ${deliveryTime}`;
        } else {
          message += `\n⚡ *Тип доставки:* Как можно скорее`;
        }
      } else if (status === 'DELIVERED') {
        message += `\n\n🎉 Спасибо за заказ! Приятного аппетита!`;
      } else if (status === 'CANCELLED') {
        message += `\n\n😔 Приносим извинения за неудобства`;
      } else if (status === 'PREPARING') {
        message += `\n\n⏱️ Ваш заказ готовится. Ожидайте уведомления о доставке`;
      }

      await this.bot.sendMessage(order.user.telegram_user_id, message, {
        parse_mode: 'Markdown'
      });

      console.log(`📱 Уведомление о статусе отправлено клиенту для заказа #${orderId}`);
    } catch (error) {
      console.error('Ошибка отправки уведомления о статусе:', error);
    }
  }




    private async sendAdminOrderNotification(
    order: any, 
    store: any, 
    items: any[], 
    telegramUserId: string
  ) {
    if (!this.bot) return;

    try {
      const customerName = order.user.name || 'Неизвестный покупатель';
      const customerPhone = order.user.phone_number || 'Не указан';
      
      // Формируем текст сообщения
      let message = `🛒 *Новый заказ #${order.id}*\n\n`;
      message += `👤 *Покупатель:* ${customerName}\n`;
      message += `📞 *Телефон:* ${customerPhone}\n`;
      message += `📍 *Адрес доставки:* ${order.address}\n\n`;
      message += `📦 *Товары для подтверждения:*\n`;

      let totalAmount = 0;
      items.forEach((item, index) => {
        const itemTotal = item.quantity * item.price;
        totalAmount += itemTotal;
        message += `${index + 1}. ${item.product.name}\n`;
        message += `   Количество: ${item.quantity} шт.\n`;
        message += `   Цена: ${item.price} ₸/шт.\n`;
        message += `   Сумма: ${itemTotal} ₸\n\n`;
      });

     
      message += `⚡ *Требуется подтверждение наличия товаров!*`;

      // Создаем inline клавиатуру для каждого товара
      const keyboard = [];
      
      for (const item of items) {
        // Получаем ID подтверждения для этого товара
        const confirmation = await prisma.storeOrderConfirmation.findFirst({
          where: {
            orderItem: {
              orderId: order.id,
              productId: item.productId
            },
            storeId: store.id
          }
        });

        if (confirmation) {
          const confirmedData = `confirm_item:${confirmation.id}:CONFIRMED:${item.quantity}`;
          const partialData = `confirm_item:${confirmation.id}:PARTIAL:0`;
          const rejectedData = `confirm_item:${confirmation.id}:REJECTED:0`;
          
          console.log('🎯 Создаем кнопки для товара:', {
            productName: item.product.name,
            confirmationId: confirmation.id,
            confirmedData,
            partialData,
            rejectedData,
            confirmedDataLength: confirmedData.length,
            partialDataLength: partialData.length,
            rejectedDataLength: rejectedData.length
          });
          
          keyboard.push([
            {
              text: `✅ ${item.product.name} - В наличии`,
              callback_data: confirmedData
            }
          ]);
          keyboard.push([
            {
              text: `⚠️ ${item.product.name} - Частично`,
              callback_data: partialData
            },
            {
              text: `❌ ${item.product.name} - Нет в наличии`,
              callback_data: rejectedData
            }
          ]);
        } else {
          console.warn('❌ Не найдено подтверждение для товара:', {
            orderId: order.id,
            productId: item.productId,
            storeId: store.id
          });
        }
      }

      console.log('📤 Отправляем сообщение продавцу:', {
        telegramUserId,
        storeName: store.name,
        keyboardRows: keyboard.length,
        totalButtons: keyboard.reduce((sum, row) => sum + row.length, 0)
      });

      // Отправляем сообщение
      await this.bot.sendMessage(telegramUserId, message, {
        parse_mode: 'Markdown',
        
      });

      console.log(`📱 Уведомление отправлено админу ${store.name} (${telegramUserId})`);
      
    } catch (error) {
      console.error(`Ошибка отправки уведомления продавцу ${telegramUserId}:`, error);
      throw error;
    }
  }
}





export const telegramService = new TelegramNotificationService();
