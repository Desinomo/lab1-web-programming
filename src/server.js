// server.js
const express = require("express");
const dotenv = require("dotenv");
const helmet = require("helmet");
const cors = require("cors");
const rateLimit = require("express-rate-limit");
const swaggerUi = require("swagger-ui-express");
const swaggerSpecs = require("./config/swagger");
const http = require('http');
const { initSocket } = require('./socket'); // 👈 Імпортуємо тільки initSocket

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

// Middleware
app.use(helmet());
app.use(cors({
    // Додаємо admin.socket.io для тестування
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
// Запускаємо 'server', а не 'app'
server.listen(PORT, () => {
    console.log(`Сервер запущено на порту ${PORT}`);
    console.log(`Документація API: http://localhost:${PORT}/api-docs`);
});