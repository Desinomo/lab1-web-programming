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
const { setIO: setOrderIO } = require('./controllers/orderController');
const { setIO: setProductIO } = require('./controllers/productController');
const { setIO: setCustomerIO } = require('./controllers/customerController');
const { setIO: setAuthIO } = require('./controllers/authController');
const { setIO: setFileIO } = require('./controllers/fileController');
const { setIO: setIngredientIO } = require('./controllers/ingredientController');
const { setIO: setRecipeIO } = require('./controllers/recipeController');

// Встановлюємо io
setOrderIO(io);
setProductIO(io);
setCustomerIO(io);
setAuthIO(io);
setFileIO(io);
setIngredientIO(io);
setRecipeIO(io);
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
const io = initSocket(server); // Socket.IO

// Middleware
app.use(helmet());
app.use(cors({
    origin: process.env.FRONTEND_URL || 'http://localhost:5173',
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
const PORT = process.env.PORT || 3000; // Render підставить свій порт через process.env.PORT
server.listen(PORT, () => {
    console.log(`Сервер запущено на порту ${PORT}`);
    console.log(`Документація API: http://localhost:${PORT}/api-docs`);
});
