// socket/index.js
const { Server } = require("socket.io");
const jwt = require('jsonwebtoken');
const { PrismaClient } = require('@prisma/client'); // Потрібно для перевірки користувача

const prisma = new PrismaClient();
let io; // Змінна для зберігання екземпляру Socket.IO сервера

// Функція для ініціалізації Socket.IO
function initSocket(httpServer) {
    io = new Server(httpServer, {
        cors: {
            origin: [
                process.env.FRONTEND_URL || "http://localhost:5173",
                "https://admin.socket.io" // 👈 Додайте цей рядок
            ],
            methods: ["GET", "POST"],
            credentials: true
        }
    });

    console.log("Socket.IO initialized");

    // --- АВТЕНТИФІКАЦІЯ СОКЕТА (Рівень 2, але потрібен для кімнат) ---
    // Це middleware, яке запускається для *кожного* нового сокет-з'єднання
    io.use(async (socket, next) => {
        try {
            // Клієнт має надіслати токен при підключенні
            const token = socket.handshake.auth.token;

            if (!token) {
                return next(new Error('Authentication error: Token not provided'));
            }

            // Перевіряємо токен
            const decoded = jwt.verify(token, process.env.JWT_SECRET);

            // Знаходимо користувача в БД
            const user = await prisma.user.findUnique({
                where: { id: decoded.userId },
                select: { id: true, role: true }
            });

            if (!user) {
                return next(new Error('Authentication error: User not found'));
            }

            // Зберігаємо дані про користувача в самому об'єкті сокета
            socket.user = user;
            next(); // Дозволяємо підключення

        } catch (err) {
            console.error("Socket auth error:", err.message);
            next(new Error('Authentication error: Invalid token'));
        }
    });


    // Обробка нових підключень (після автентифікації)
    io.on('connection', (socket) => {
        // Тепер ми маємо доступ до socket.user
        console.log(`A user connected: ${socket.id}, Role: ${socket.user.role}`);

        // --- 3. СИСТЕМА КІМНАТ (Рівень 1) ---
        // Автоматично приєднуємо користувача до кімнати на основі його ролі
        socket.join(socket.user.role); // Напр. кімната 'ADMIN', 'MODERATOR', 'USER'

        // Також приєднуємо до персональної кімнати (для майбутніх приватних сповіщень)
        socket.join(`user_${socket.user.id}`);

        console.log(`Socket ${socket.id} joined rooms: '${socket.user.role}' and 'user_${socket.user.id}'`);

        // Обробка відключення
        socket.on('disconnect', () => {
            console.log('User disconnected:', socket.id);
        });

        // Ви можете видалити ці обробники, якщо вони вам не потрібні
        socket.on('joinRoom', (roomName) => {
            socket.join(roomName);
            console.log(`Socket ${socket.id} joined room ${roomName}`);
        });

        socket.on('leaveRoom', (roomName) => {
            socket.leave(roomName);
            console.log(`Socket ${socket.id} left room ${roomName}`);
        });

    });

    return io; // Повертаємо ініціалізований екземпляр io
}

// Функція для отримання екземпляру io (щоб використовувати в контролерах)
function getIO() {
    if (!io) {
        throw new Error("Socket.IO not initialized!");
    }
    return io;
}

module.exports = { initSocket, getIO }; // Експортуємо функції