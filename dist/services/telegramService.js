"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.telegramService = exports.TelegramNotificationService = void 0;
const node_telegram_bot_api_1 = __importDefault(require("node-telegram-bot-api"));
const prisma_1 = __importDefault(require("../lib/prisma"));
const errorHandler_1 = require("../middlewares/errorHandler");
class TelegramNotificationService {
    constructor() {
        this.bot = null;
        this.isProduction = false;
        const token = process.env.TELEGRAM_BOT_TOKEN;
        if (!token) {
            console.warn('TELEGRAM_BOT_TOKEN не найден в переменных окружения. Telegram уведомления отключены.');
            return;
        }
        this.isProduction = process.env.NODE_ENV === 'production';
        this.bot = new node_telegram_bot_api_1.default(token, {
            polling: true, // Включаем polling во всех режимах для обработки callback queries
            webHook: false
        });
        console.log('🤖 Telegram бот инициализирован с polling:', true);
        this.setupBotHandlers();
        this.startCleanupTask();
    }
    setupBotHandlers() {
        if (!this.bot)
            return;
        // Обработчик для подтверждения товаров
        this.bot.on('callback_query', (query) => __awaiter(this, void 0, void 0, function* () {
            var _a, _b;
            console.log('🔔 Получен callback query:', {
                id: query.id,
                data: query.data,
                from: ((_a = query.from) === null || _a === void 0 ? void 0 : _a.username) || ((_b = query.from) === null || _b === void 0 ? void 0 : _b.id)
            });
            try {
                if (!query.data || !query.message) {
                    console.log('❌ Отсутствует data или message в callback query');
                    return;
                }
                const [action, confirmationId, status, quantity] = query.data.split(':');
                console.log('📊 Парсинг callback data:', { action, confirmationId, status, quantity });
                if (action === 'confirm_item') {
                    yield this.handleItemConfirmation(parseInt(confirmationId), status, quantity ? parseInt(quantity) : undefined, query);
                }
                else if (action === 'courier_delivered') {
                    const orderId = parseInt(confirmationId);
                    const courierId = parseInt(status);
                    yield this.handleCourierDelivery(orderId, courierId, query);
                }
            }
            catch (error) {
                console.error('Ошибка обработки callback query:', error);
                if (this.bot) {
                    yield this.bot.answerCallbackQuery(query.id, {
                        text: 'Произошла ошибка. Попробуйте позже.',
                        show_alert: true
                    });
                }
            }
        }));
        // Обработчик текстовых сообщений для ввода количества
        this.bot.on('message', (msg) => __awaiter(this, void 0, void 0, function* () {
            try {
                if (!msg.text || msg.text.startsWith('/') || !msg.from)
                    return;
                // Проверяем, ожидается ли ввод количества от этого пользователя
                const pendingInput = yield this.checkPendingQuantityInput(msg.from.id.toString());
                if (pendingInput) {
                    yield this.handleQuantityInput(msg, pendingInput);
                }
            }
            catch (error) {
                console.error('Ошибка обработки текстового сообщения:', error);
            }
        }));
    }
    /**
     * Запускает задачу очистки просроченных состояний
     */
    startCleanupTask() {
        // Очищаем просроченные состояния каждые 5 минут
        setInterval(() => __awaiter(this, void 0, void 0, function* () {
            try {
                yield prisma_1.default.telegramUserState.deleteMany({
                    where: {
                        expiresAt: {
                            lte: new Date()
                        }
                    }
                });
            }
            catch (error) {
                console.error('Ошибка очистки просроченных состояний:', error);
            }
        }), 5 * 60 * 1000); // 5 минут
    }
    /**
     * Отправляет уведомления продавцам о новом заказе
     */
    sendNewOrderNotifications(orderId) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                // Получаем информацию о заказе и товарах
                const order = yield prisma_1.default.order.findUnique({
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
                    throw new errorHandler_1.AppError('Заказ не найден', 404);
                }
                // Получаем уникальные ID магазинов из заказа
                const storeIds = [...new Set(order.items.map(item => item.product.storeId))];
                console.log('🏪 Магазины в заказе:', storeIds);
                // Находим всех продавцов (SELLER) для этих магазинов
                const sellers = yield prisma_1.default.user.findMany({
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
                console.log('👥 Найдены продавцы:', sellers.map(s => {
                    var _a, _b;
                    return ({
                        id: s.id,
                        name: s.name,
                        role: s.role,
                        storeId: (_a = s.ownedStore) === null || _a === void 0 ? void 0 : _a.id,
                        storeName: (_b = s.ownedStore) === null || _b === void 0 ? void 0 : _b.name,
                        telegram: s.telegram_user_id
                    });
                }));
                // Группируем товары по магазинам
                const storeGroups = new Map();
                for (const item of order.items) {
                    const storeId = item.product.storeId;
                    if (!storeGroups.has(storeId)) {
                        storeGroups.set(storeId, []);
                    }
                    storeGroups.get(storeId).push(item);
                }
                // Отправляем уведомления каждому продавцу только для его магазина
                const notifications = sellers.map((seller) => __awaiter(this, void 0, void 0, function* () {
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
                }));
                yield Promise.all(notifications.filter(Boolean));
                console.log(`✅ Отправлены уведомления для заказа #${orderId}`);
            }
            catch (error) {
                console.error('Ошибка отправки уведомлений о заказе:', error);
                throw error;
            }
        });
    }
    /**
     * Отправляет уведомление конкретному продавцу
     */
    sendStoreOrderNotification(order, store, items, telegramUserId) {
        return __awaiter(this, void 0, void 0, function* () {
            if (!this.bot)
                return;
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
                    const confirmation = yield prisma_1.default.storeOrderConfirmation.findFirst({
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
                    }
                    else {
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
                yield this.bot.sendMessage(telegramUserId, message, {
                    parse_mode: 'Markdown',
                    reply_markup: {
                        inline_keyboard: keyboard
                    }
                });
                console.log(`📱 Уведомление отправлено продавцу ${store.name} (${telegramUserId})`);
            }
            catch (error) {
                console.error(`Ошибка отправки уведомления продавцу ${telegramUserId}:`, error);
                throw error;
            }
        });
    }
    /**
     * Обрабатывает подтверждение товара продавцом
     */
    handleItemConfirmation(confirmationId_1, status_1) {
        return __awaiter(this, arguments, void 0, function* (confirmationId, status, quantity = 0, query) {
            var _a, _b, _c;
            if (!this.bot)
                return;
            console.log('🔄 Обработка подтверждения товара:', {
                confirmationId,
                status,
                quantity,
                from: ((_a = query.from) === null || _a === void 0 ? void 0 : _a.username) || ((_b = query.from) === null || _b === void 0 ? void 0 : _b.id)
            });
            try {
                const confirmation = yield prisma_1.default.storeOrderConfirmation.findUnique({
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
                    yield this.bot.answerCallbackQuery(query.id, {
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
                    yield this.bot.answerCallbackQuery(query.id, {
                        text: 'Этот товар уже подтвержден',
                        show_alert: true
                    });
                    return;
                }
                // Если частичное подтверждение, запрашиваем количество
                if (status === 'PARTIAL') {
                    console.log('❓ Запрашиваем количество для частичного подтверждения');
                    yield this.requestQuantityInput(query.from.id.toString(), confirmationId, confirmation.orderItem.product.name, confirmation.orderItem.quantity);
                    yield this.bot.answerCallbackQuery(query.id, {
                        text: 'Укажите доступное количество'
                    });
                    return;
                }
                // Обновляем подтверждение
                const finalQuantity = status === 'REJECTED' ? 0 : quantity;
                console.log('💾 Обновляем подтверждение в БД:', {
                    status,
                    finalQuantity,
                    confirmedById: (_c = confirmation.store.owner) === null || _c === void 0 ? void 0 : _c.id
                });
                yield prisma_1.default.storeOrderConfirmation.update({
                    where: { id: confirmationId },
                    data: {
                        status,
                        confirmedQuantity: finalQuantity,
                        confirmedAt: new Date(),
                        confirmedById: confirmation.store.owner.id
                    }
                });
                const statusText = {
                    'CONFIRMED': '✅ подтвержден',
                    'REJECTED': '❌ отклонен',
                    'PARTIAL': '⚠️ частично подтвержден'
                };
                console.log('✅ Подтверждение успешно обновлено');
                yield this.bot.answerCallbackQuery(query.id, {
                    text: `Товар "${confirmation.orderItem.product.name}" ${statusText[status]}`
                });
                // Обновляем сообщение
                yield this.updateOrderMessage(query.message, confirmation.orderItem.order.id);
            }
            catch (error) {
                console.error('Ошибка подтверждения товара:', error);
                if (this.bot) {
                    yield this.bot.answerCallbackQuery(query.id, {
                        text: 'Произошла ошибка',
                        show_alert: true
                    });
                }
            }
        });
    }
    /**
     * Запрашивает ввод количества для частичного подтверждения
     */
    requestQuantityInput(telegramUserId, confirmationId, productName, maxQuantity) {
        return __awaiter(this, void 0, void 0, function* () {
            if (!this.bot)
                return;
            try {
                // Сохраняем состояние ожидания ввода
                const expiresAt = new Date();
                expiresAt.setMinutes(expiresAt.getMinutes() + 10); // Состояние действует 10 минут
                yield prisma_1.default.telegramUserState.upsert({
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
                yield this.bot.sendMessage(telegramUserId, message, {
                    reply_markup: {
                        force_reply: true,
                        selective: true
                    }
                });
            }
            catch (error) {
                console.error('Ошибка запроса количества:', error);
            }
        });
    }
    /**
     * Проверяет, ожидается ли ввод количества от пользователя
     */
    checkPendingQuantityInput(telegramUserId) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const userState = yield prisma_1.default.telegramUserState.findUnique({
                    where: { telegram_user_id: telegramUserId }
                });
                if (!userState || userState.expiresAt < new Date()) {
                    return null;
                }
                if (userState.state === 'waiting_quantity_input' && userState.data) {
                    const data = userState.data;
                    return {
                        confirmationId: data.confirmationId,
                        productName: data.productName,
                        maxQuantity: data.maxQuantity
                    };
                }
                return null;
            }
            catch (error) {
                console.error('Ошибка проверки состояния пользователя:', error);
                return null;
            }
        });
    }
    /**
     * Обрабатывает ввод количества пользователем
     */
    handleQuantityInput(message, pendingInput) {
        return __awaiter(this, void 0, void 0, function* () {
            if (!this.bot || !message.from)
                return;
            try {
                const quantity = parseInt(message.text || '');
                if (isNaN(quantity) || quantity < 1 || quantity >= pendingInput.maxQuantity) {
                    yield this.bot.sendMessage(message.from.id, `❌ Неверное количество. Введите число от 1 до ${pendingInput.maxQuantity - 1}`);
                    return;
                }
                // Обновляем подтверждение
                const confirmation = yield prisma_1.default.storeOrderConfirmation.findUnique({
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
                    yield this.bot.sendMessage(message.from.id, '❌ Ошибка: подтверждение не найдено');
                    return;
                }
                yield prisma_1.default.storeOrderConfirmation.update({
                    where: { id: pendingInput.confirmationId },
                    data: {
                        status: 'PARTIAL',
                        confirmedQuantity: quantity,
                        confirmedAt: new Date(),
                        confirmedById: confirmation.store.owner.id
                    }
                });
                // Удаляем состояние ожидания
                yield prisma_1.default.telegramUserState.delete({
                    where: { telegram_user_id: message.from.id.toString() }
                });
                yield this.bot.sendMessage(message.from.id, `✅ Подтверждено частичное наличие товара "${pendingInput.productName}": ${quantity} шт.`);
                // Обновляем исходное сообщение с заказом (находим его через историю сообщений)
                // Поскольку у нас нет прямой ссылки на сообщение, отправляем новое обновленное уведомление
                try {
                    yield this.sendOrderStatusSummary(confirmation.orderItem.orderId, message.from.id.toString());
                }
                catch (error) {
                    console.error('Ошибка отправки обновленного статуса заказа:', error);
                }
            }
            catch (error) {
                console.error('Ошибка обработки ввода количества:', error);
                if (this.bot) {
                    yield this.bot.sendMessage(message.from.id, '❌ Произошла ошибка при обработке');
                }
            }
        });
    }
    /**
     * Обновляет сообщение с информацией о заказе
     */
    updateOrderMessage(message, orderId) {
        return __awaiter(this, void 0, void 0, function* () {
            var _a;
            if (!this.bot)
                return;
            try {
                // Получаем актуальную информацию о заказе и подтверждениях
                const order = yield prisma_1.default.order.findUnique({
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
                const confirmations = yield prisma_1.default.storeOrderConfirmation.findMany({
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
                const store = (_a = order.items[0]) === null || _a === void 0 ? void 0 : _a.product.store;
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
                const pendingItems = [];
                order.items.forEach((item, index) => {
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
                        updateText += `   Статус: ${statusEmoji[confirmation.status]}\n`;
                        // Добавляем в список ожидающих, если статус PENDING
                        if (confirmation.status === 'PENDING') {
                            pendingItems.push({
                                item,
                                confirmationId: confirmation.id
                            });
                        }
                    }
                    else {
                        updateText += `   Статус: ⏳ Ожидает подтверждения\n`;
                    }
                    updateText += '\n';
                });
                updateText += `💰 *Итого по вашему магазину:* ${totalAmount} ₸\n\n`;
                // Создаем клавиатуру только для неподтвержденных товаров
                const keyboard = [];
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
                }
                else {
                    updateText += `✅ *Все товары подтверждены!*`;
                }
                console.log('📝 Обновляем сообщение:', {
                    orderId,
                    pendingItemsCount: pendingItems.length,
                    keyboardRows: keyboard.length
                });
                // Обновляем сообщение с новым текстом и клавиатурой
                yield this.bot.editMessageText(updateText, {
                    chat_id: message.chat.id,
                    message_id: message.message_id,
                    parse_mode: 'Markdown',
                    reply_markup: {
                        inline_keyboard: keyboard
                    }
                });
            }
            catch (error) {
                console.error('Ошибка обновления сообщения:', error);
            }
        });
    }
    /**
     * Отправляет уведомление о статусе заказа
     */
    sendOrderStatusUpdate(orderId, newStatus) {
        return __awaiter(this, void 0, void 0, function* () {
            if (!this.bot)
                return;
            try {
                const order = yield prisma_1.default.order.findUnique({
                    where: { id: orderId },
                    include: {
                        user: { select: { telegram_user_id: true, name: true } }
                    }
                });
                if (!order || !order.user.telegram_user_id)
                    return;
                const statusMessages = {
                    'WAITING_PAYMENT': '💳 Ожидает оплаты',
                    'PREPARING': '📦 Готовится к отправке',
                    'DELIVERING': '🚚 В пути',
                    'DELIVERED': '✅ Доставлен',
                    'CANCELLED': '❌ Отменен'
                };
                const message = `🔔 Статус заказа #${orderId} изменен\n\n` +
                    `${statusMessages[newStatus] || newStatus}`;
                yield this.bot.sendMessage(order.user.telegram_user_id, message);
            }
            catch (error) {
                console.error('Ошибка отправки уведомления о статусе:', error);
            }
        });
    }
    /**
     * Отправляет краткую сводку о текущем статусе подтверждений по заказу
     */
    sendOrderStatusSummary(orderId, telegramUserId) {
        return __awaiter(this, void 0, void 0, function* () {
            if (!this.bot)
                return;
            try {
                // Получаем информацию о подтверждениях
                const confirmations = yield prisma_1.default.storeOrderConfirmation.findMany({
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
                    summaryText += `${statusEmoji[conf.status]} ${conf.orderItem.product.name}`;
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
                }
                else {
                    summaryText += '\n✅ Все товары обработаны!';
                }
                yield this.bot.sendMessage(telegramUserId, summaryText, {
                    parse_mode: 'Markdown'
                });
            }
            catch (error) {
                console.error('Ошибка отправки сводки статуса заказа:', error);
            }
        });
    }
    /**
     * Отправляет уведомление курьеру о назначении заказа
     */
    sendCourierAssignmentNotification(orderId, courierId) {
        return __awaiter(this, void 0, void 0, function* () {
            var _a;
            if (!this.bot)
                return;
            try {
                // Получаем информацию о заказе и курьере
                const order = yield prisma_1.default.order.findUnique({
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
                if (!order || !((_a = order.courier) === null || _a === void 0 ? void 0 : _a.telegram_user_id)) {
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
                }
                else {
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
                yield this.bot.sendMessage(order.courier.telegram_user_id, message, {
                    parse_mode: 'Markdown',
                    reply_markup: {
                        inline_keyboard: keyboard
                    }
                });
                console.log(`📱 Уведомление о назначении заказа #${orderId} отправлено курьеру ${order.courier.name || courierId}`);
            }
            catch (error) {
                console.error('Ошибка отправки уведомления курьеру:', error);
                throw error;
            }
        });
    }
    /**
     * Обрабатывает подтверждение доставки от курьера
     */
    handleCourierDelivery(orderId, courierId, query) {
        return __awaiter(this, void 0, void 0, function* () {
            var _a, _b, _c;
            if (!this.bot)
                return;
            console.log('🚚 Обработка подтверждения доставки:', {
                orderId,
                courierId,
                from: ((_a = query.from) === null || _a === void 0 ? void 0 : _a.username) || ((_b = query.from) === null || _b === void 0 ? void 0 : _b.id)
            });
            try {
                // Проверяем, что заказ назначен этому курьеру
                const order = yield prisma_1.default.order.findUnique({
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
                    yield this.bot.answerCallbackQuery(query.id, {
                        text: 'Заказ не найден',
                        show_alert: true
                    });
                    return;
                }
                if (order.courierId !== courierId) {
                    yield this.bot.answerCallbackQuery(query.id, {
                        text: 'Этот заказ не назначен вам',
                        show_alert: true
                    });
                    return;
                }
                const currentStatus = (_c = order.statuses[0]) === null || _c === void 0 ? void 0 : _c.status;
                if (currentStatus === 'DELIVERED') {
                    yield this.bot.answerCallbackQuery(query.id, {
                        text: 'Заказ уже отмечен как доставленный',
                        show_alert: true
                    });
                    return;
                }
                if (currentStatus !== 'DELIVERING') {
                    yield this.bot.answerCallbackQuery(query.id, {
                        text: 'Можно отметить доставленным только заказ в статусе "В пути"',
                        show_alert: true
                    });
                    return;
                }
                // Обновляем статус заказа на DELIVERED
                yield prisma_1.default.orderStatus.create({
                    data: {
                        orderId,
                        status: 'DELIVERED'
                    }
                });
                console.log(`✅ Заказ #${orderId} отмечен курьером ${courierId} как доставленный`);
                yield this.bot.answerCallbackQuery(query.id, {
                    text: '✅ Заказ отмечен как доставленный!'
                });
                // Обновляем сообщение, убирая кнопку
                if (query.message) {
                    const updatedText = query.message.text + '\n\n✅ *Заказ доставлен!*';
                    yield this.bot.editMessageText(updatedText, {
                        chat_id: query.message.chat.id,
                        message_id: query.message.message_id,
                        parse_mode: 'Markdown'
                    });
                }
                // Отправляем уведомление покупателю о доставке
                yield this.sendOrderStatusUpdate(orderId, 'DELIVERED');
            }
            catch (error) {
                console.error('Ошибка обработки подтверждения доставки:', error);
                if (this.bot) {
                    yield this.bot.answerCallbackQuery(query.id, {
                        text: 'Произошла ошибка',
                        show_alert: true
                    });
                }
            }
        });
    }
}
exports.TelegramNotificationService = TelegramNotificationService;
exports.telegramService = new TelegramNotificationService();
