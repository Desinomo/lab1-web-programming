console.log("Запускаємо клієнт...");

// --- 🛑 ВАЖЛИВО: Вставте сюди ваш токен! ---
// Отримайте його зі Swagger (login)
const YOUR_JWT_TOKEN = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOjIsInJvbGUiOiJVU0VSIiwiaWF0IjoxNzYxODM2OTk3LCJleHAiOjE3NjI0NDE3OTd9.aj2T9RIMHy-vi16P0RgaAlqvhEtR4Bqv_uIaUnkZGqo";

const socket = io("https://lab1-web-programming.onrender.com", {
    // Надсилаємо наш токен для автентифікації
    auth: {
        token: YOUR_JWT_TOKEN
    }
});

// --- Слухачі подій ---

socket.on("connect", () => {
    console.log(`✅ УСПІХ! Підключено до сервера. Ваш Socket ID: ${socket.id}`);
});

socket.on("connect_error", (err) => {
    console.error(`❌ ПОМИЛКА ПІДКЛЮЧЕННЯ: ${err.message}`);
    console.error("Повна помилка:", err);
});

socket.on("disconnect", (reason) => {
    console.warn(`Відключено від сервера. Причина: ${reason}`);
});

// --- Слухаємо ваші кастомні події (для пунктів 4 та 5) ---
console.log("Слухаємо події 'notification:new' та 'product:created'...");

socket.on("notification:new", (data) => {
    console.log("🔔 Нове сповіщення:", data);
});

socket.on("product:created", (data) => {
    console.log("📦 Створено новий продукт:", data);
});