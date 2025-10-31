// ================================================================
// 🚀 ПАСИВНИЙ СЛУХАЧ SOCKET.IO (Рівень 2)
// Вставте цей код у консоль вашого браузера (F12)
// ================================================================

(function () {
    console.clear();
    console.log("%cЗапускаємо тестовий слухач...", "font-size: 16px; font-weight: bold;");

    // --- 🛑 ВАЖЛИВО: Вставте сюди ваш АКТУАЛЬНИЙ токен! ---
    const YOUR_JWT_TOKEN = "eyJhbGciOiJIZXV...Yl0zlWLVSKhdt"; // 👈 Замініть це

    // --- 🛑 ВАЖЛИВО: Вставте URL вашого сервера ---
    const SERVER_URL = "https://lab1-web-programming.onrender.com";
    // const SERVER_URL = "http://localhost:3000"; // (для локального тесту)

    // --- Перевірка ---
    if (YOUR_JWT_TOKEN === "eyJhbGciOiJIZXV...Yl0zlWLVSKhdt" || !YOUR_JWT_TOKEN) {
        console.error("❌ ПОМИЛКА: Будь ласка, вставте ваш реальний JWT токен у змінну YOUR_JWT_TOKEN.");
        return;
    }
    if (typeof io === "undefined") {
        console.error("❌ ПОМИЛКА: Не знайдено 'io'. Переконайтеся, що ви на сторінці Swagger (де є socket.io) або додайте скрипт вручну.");
        return;
    }

    // --- 1. ПІДКЛЮЧЕННЯ ---
    console.log(`Підключаємось до ${SERVER_URL}...`);

    // Закриваємо старі з'єднання
    if (window.myTestSocket && window.myTestSocket.connected) {
        console.warn("Закриваємо попереднє тестове з'єднання...");
        window.myTestSocket.disconnect();
    }

    const socket = io(SERVER_URL, {
        auth: { token: YOUR_JWT_TOKEN },
        reconnection: true,
        transports: ['websocket']
    });

    // Робимо сокет доступним глобально для відладки
    window.myTestSocket = socket;

    // ================================================================
    // --- 2. СЛУХАЧІ СИСТЕМНИХ ПОДІЙ (Підключення, Автентифікація) ---
    // ================================================================

    console.groupCollapsed("Системні Логи (Підключення, Відключення)");

    socket.on("connect", () => {
        console.log(`✅ УСПІХ! (Рівень 2.1). Підключено. Socket ID: ${socket.id}`);
        console.groupEnd();
        console.log("%cТепер спробуйте щось створити/оновити у Swagger...", "color: blue;");

        // (Рівень 2.4) Запитуємо, хто онлайн
        console.log("Запитуємо список онлайн користувачів...");
        socket.emit("users:getOnline", (onlineIds) => {
            console.log("🟢 [Відповідь] Зараз онлайн:", onlineIds);
        });
    });

    socket.on("connect_error", (err) => {
        console.error(`❌ ПОМИЛКА ПІДКЛЮЧЕННЯ (Рівень 2.1): ${err.message}`);
        if (err.message.includes("Invalid token")) {
            console.error("-> Перевірте, чи ваш JWT токен не прострочений.");
        }
        console.groupEnd();
    });

    socket.on("disconnect", (reason) => {
        console.warn(`Відключено. Причина: ${reason}`);
        console.groupEnd();
    });

    // (Рівень 2.5) Reconnection
    socket.on("reconnect_attempt", (attempt) => {
        console.log(`Спроба перепідключення #${attempt}...`);
    });

    console.groupEnd();

    // ================================================================
    // --- 3. СЛУХАЧІ ПОДІЙ ДОДАТКА (Сповіщення, Оновлення) ---
    // ================================================================

    console.log("%cСлухаємо події сповіщень та оновлень...", "font-weight: bold;");

    // (Рівень 2.2) Персоналізовані сповіщення
    socket.on("notification:new", (data) => {
        console.group("🔔 [Рівень 2.2] ОТРИМАНО СПОВІЩЕННЯ");
        console.log("Тип:", data.type);
        console.log("Повідомлення:", data.message);
        console.log("Дані:", data);
        console.groupEnd();
    });

    // (Рівень 2.4) Індикатори онлайн-статусу
    socket.on("user:online", (data) => {
        console.log(`🟢 [Рівень 2.4] Статус: Користувач ${data.userId} тепер онлайн.`);
    });
    socket.on("user:offline", (data) => {
        console.log(`🔴 [Рівень 2.4] Статус: Користувач ${data.userId} став офлайн.`);
    });

    // (Рівень 2.3) Real-time оновлення сутностей
    const eventsToLog = [
        "product:created", "product:updated", "product:deleted",
        "customer:created", "customer:updated", "customer:deleted",
        "order:created", "order:updated", "order:deleted",
        "ingredient:created", "ingredient:updated", "ingredient:deleted",
        "recipe:created", "recipe:updated", "recipe:deleted",
        "file:uploaded", "file:deleted"
    ];

    eventsToLog.forEach(event => {
        socket.on(event, (data) => {
            console.group(`📦 [Рівень 2.3] ОТРИМАНО ПОДІЮ: ${event}`);
            console.log("Дані:", data);
            console.groupEnd();
        });
    });

    // ================================================================
    // --- 4. ІНТЕРАКТИВНІ ФУНКЦІЇ ---
    // ================================================================

    console.log("%c✅ Слухач готовий. Ви можете викликати функцію:", "color: green;");
    console.log("-> getOnlineUsers() - отримати список ID, хто зараз онлайн.");

    // (Рівень 2.4) Функція для тестування онлайн-статусу
    window.getOnlineUsers = function () {
        if (!window.myTestSocket || !window.myTestSocket.connected) {
            console.error("Сокет не підключено.");
            return;
        }

        console.log("Запитуємо список онлайн користувачів...");
        window.myTestSocket.emit("users:getOnline", (onlineIds) => {
            console.log("🟢 [Відповідь] Зараз онлайн:", onlineIds);
        });
    }

})();