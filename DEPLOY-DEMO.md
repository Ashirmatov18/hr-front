# Как запустить проект: HR Ecosystem (WordPress backend + Telegram Mini App)

## Что входит в проект

1. Backend: WordPress-плагин `hr-ecosystem-plugin`.
2. Frontend: папка `mini-app` (HTML/CSS/JS).

## Вариант 1: быстрый запуск для демо (локальный WP + ngrok)

### Шаг 1. Запустить WordPress

1. Подними WordPress локально (XAMPP/OpenServer/Local/docker).
2. Установи и активируй плагин `hr-ecosystem-plugin`.
3. Убедись, что API отвечает по адресу:
   `https://ТВОЙ_ДОМЕН/wp-json/hr/v1/me` (должен быть JSON-ответ или 401).

### Шаг 2. Открыть WordPress наружу через ngrok

1. Установи ngrok: https://ngrok.com/download
2. Добавь токен:
   ```bash
   ngrok config add-authtoken YOUR_TOKEN
   ```
3. Запусти туннель на порт WordPress:
   ```bash
   ngrok http 80
   ```
4. Скопируй HTTPS URL из `Forwarding` (например `https://abc.ngrok-free.app`).

### Шаг 3. Настроить mini-app

1. Открой `mini-app/js/config.js`.
2. Укажи:
   - `API_BASE_URL`: URL WordPress (ngrok или боевой домен), без слэша в конце.
   - `DEV_TOKEN`: пусто для Telegram-режима.
3. Задеплой папку `mini-app` на любой статический хостинг (Vercel/Netlify/FTP).

### Шаг 4. Привязать mini-app к боту

1. В `@BotFather` выбери существующего бота.
2. Настрой `Menu Button` с URL mini-app.
3. В WordPress в `HR Ecosystem -> Settings` укажи `Telegram Bot Token` этого же бота.

### Шаг 5. Проверка

1. Открой личный чат с ботом.
2. Нажми кнопку Menu Button.
3. Должен открыться mini-app и пройти авторизация через Telegram.

## Вариант 2: нормальный прод-запуск (без ngrok)

### Backend

1. Залей плагин в:
   `wp-content/plugins/hr-ecosystem-plugin`
2. Активируй плагин в WordPress.
3. Заполни настройки в `HR Ecosystem -> Settings`.

### Frontend

1. Залей папку `mini-app` на домен заказчика, например:
   `public_html/mini-app`
2. Рабочий URL будет:
   `https://YOUR_DOMAIN/mini-app/`
3. В `mini-app/js/config.js` укажи:
   - `API_BASE_URL = 'https://YOUR_DOMAIN'`

### Telegram

1. В `@BotFather` у этого же бота поставь URL:
   `https://YOUR_DOMAIN/mini-app/`
2. Проверь открытие из бота.

## Важно

1. Menu Button гарантированно работает в личном чате с ботом.
2. В группах кнопка не появляется автоматически как постоянная у всех участников.
3. Если нужен запуск из групп, бот должен отправлять сообщение с WebApp-кнопкой.

## Что передавать заказчику

1. Папку плагина `hr-ecosystem-plugin`.
2. Папку фронта `mini-app`.
3. Текущий `config.js`.
4. Эту инструкцию запуска.
