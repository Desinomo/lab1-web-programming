// socket/index.js
const { Server } = require("socket.io");
const jwt = require('jsonwebtoken');
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();
let io; // Єдина змінна 'io'

// Функція для ініціалізації Socket.IO
function initSocket(httpServer) {
    io = new Server(httpServer, {
        cors: {
            // Додаємо admin.socket.io для тестування
            origin: [
                process.env.FRONTEND_URL || "http://localhost:5173",
                "https://admin.socket.io"
            ],
            methods: ["GET", "POST"],
            credentials: true
        }
    });

    console.log("Socket.IO initialized");

    // --- АВТЕНТИФІКАЦІЯ СОКЕТА (Рівень 2, але потрібен для кімнат) ---
    io.use(async (socket, next) => {
        try {
            const token = socket.handshake.auth.token;
            if (!token) {
                return next(new Error('Authentication error: Token not provided'));
            }

            const decoded = jwt.verify(token, process.env.JWT_SECRET);
            const user = await prisma.user.findUnique({
                where: { id: decoded.userId },
                select: { id: true, role: true }
            });

            if (!user) {
                return next(new Error('Authentication error: User not found'));
            }

            socket.user = user; // Зберігаємо користувача в сокеті
            next(); // Дозволяємо підключення

        } catch (err) {
            console.error("Socket auth error:", err.message);
            next(new Error('Authentication error: Invalid token'));
        }
    });

    // Обробка нових підключень
    io.on('connection', (socket) => {
        console.log(`A user connected: ${socket.id}, Role: ${socket.user.role}`);

        // --- 3. СИСТЕМА КІМНАТ (Рівень 1) ---
        // Автоматично приєднуємо до кімнати на основі ролі
        socket.join(socket.user.role); // Напр. 'ADMIN', 'MODERATOR', 'USER'

        // Також приєднуємо до персональної кімнати
        socket.join(`user_${socket.user.id}`);

        console.log(`Socket ${socket.id} joined rooms: '${socket.user.role}' and 'user_${socket.user.id}'`);

        // Обробка відключення
        socket.on('disconnect', () => {
            console.log('User disconnected:', socket.id);
        });
    });

    return io;
}

// Функція для отримання екземпляру io (щоб використовувати в контролерах)
function getIO() {
    if (!io) {
        throw new Error("Socket.IO not initialized!");
    }
    return io;
}

module.exports = { initSocket, getIO };