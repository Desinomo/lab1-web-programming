// server.js
const express = require("express");
const dotenv = require("dotenv");
const helmet = require("helmet");
const cors = require("cors");
const rateLimit = require("express-rate-limit");
const swaggerUi = require("swagger-ui-express");
const swaggerSpecs = require("./config/swagger");
const http = require('http');
const { initSocket } = require('./socket');
const jwt = require('jsonwebtoken'); // 👈 **(Рівень 2) Додано JWT**

// Роути
const userRoutes = require("./routes/userRoutes");
const customerRoutes = require("./routes/customerRoutes");
const productRoutes = require("./routes/productRoutes");
const ingredientRoutes = require("./routes/ingredientRoutes");
const recipeRoutes = require("./routes/recipeRoutes");
const orderRoutes = require("./routes/orderRoutes");
const fileRoutes = require('./routes/fileRoutes');

dotenv.config();

const app = express();
const server = http.createServer(app);

// Ініціалізуємо Socket.IO
const io = initSocket(server);

// --- (Рівень 2) Автентифікація WebSocket ---
// Ця middleware-функція буде перевіряти JWT токен при кожній
// новій спробі WebSocket-підключення.
io.use((socket, next) => {
    // 1. Отримуємо токен, який клієнт має надіслати в `auth.token`
    const token = socket.handshake.auth.token;

    if (!token) {
        // 2. Якщо токена немає, відхиляємо підключення
        return next(new Error("Автентифікація не пройдена: Токен не надано."));
    }

    // 3. Верифікуємо токен
    //    Переконайтеся, що JWT_SECRET є у вашому .env файлі
    jwt.verify(token, process.env.JWT_SECRET, (err, userPayload) => {
        if (err) {
            // 4. Якщо токен невалідний (прострочений, неправильний підпис), відхиляємо
            return next(new Error("Автентифікація не пройдена: Невалідний токен."));
        }

        // 5. Якщо токен валідний, зберігаємо дані користувача
        //    в об'єкті 'socket' для подальшого використання
        socket.user = userPayload; // Наприклад, { id: 1, role: 'admin' }
        next();
    });
});
// ------------------------------------------


// Middleware
app.use(helmet());
app.use(cors({
    origin: [
        process.env.FRONTEND_URL || 'http://localhost:5173',
        'https://admin.socket.io'
    ],
    credentials: true
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

const limiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 100,
    message: 'Забагато запитів, спробуйте пізніше'
});
app.use('/api/', limiter);

// Swagger
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpecs, {
    explorer: true,
    customCss: '.swagger-ui .topbar { display: none }'
}));

// Роути
app.use("/api/auth", userRoutes);
app.use("/api/customers", customerRoutes);
app.use("/api/products", productRoutes);
app.use("/api/ingredients", ingredientRoutes);
app.use("/api/recipes", recipeRoutes);
app.use("/api/orders", orderRoutes);
app.use('/api/files', fileRoutes);

// Централізована обробка помилок
app.use((err, req, res, next) => {
    console.error(err.stack);
    if (err.name === 'MulterError') {
        if (err.code === 'LIMIT_FILE_SIZE') {
            return res.status(400).json({ error: 'Файл занадто великий' });
        }
        return res.status(400).json({ error: 'Помилка завантаження файлу' });
    }
    res.status(err.status || 500).json({ error: err.message || 'Внутрішня помилка сервера' });
});

// --- Запуск сервера ---
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`Сервер запущено на порту ${PORT}`);
    console.log(`Документація API: http://localhost:${PORT}/api-docs`);
});