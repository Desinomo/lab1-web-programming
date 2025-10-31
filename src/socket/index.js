const { Server } = require("socket.io");
const jwt = require("jsonwebtoken");
const { PrismaClient } = require("@prisma/client");

const prisma = new PrismaClient();
let io;

// --- (Рівень 2, Пункт 4) Відстеження онлайн-статусу ---
// Використовуємо Map для швидкого доступу та видалення
// Ключ: userId (String), Значення: { role: 'ADMIN', socketId: '...' }
const onlineUsers = new Map();
// ----------------------------------------------------

function initSocket(httpServer) {
    io = new Server(httpServer, {
        cors: {
            origin: [
                process.env.FRONTEND_URL || "http://localhost:5173",
                "https://admin.socket.io"
            ],
            methods: ["GET", "POST"],
            credentials: true
        }
    });

    console.log("Socket.IO initialized");

    // --- АВТЕНТИФІКАЦІЯ ---
    io.use(async (socket, next) => {
        try {
            const token = socket.handshake.auth.token;
            if (!token) return next(new Error("Authentication error: Token not provided"));

            // ❗️ Важливо: jwt.verify очікує ID користувача як 'id', а не 'userId'
            //    Перевірте, як ви створюєте токен. Я припускаю, що це 'id'.
            //    Якщо у вас 'userId', замініть `decoded.id` на `decoded.userId`.
            const decoded = jwt.verify(token, process.env.JWT_SECRET);

            // Перевіряємо, чи такий користувач вже онлайн
            if (onlineUsers.has(decoded.id.toString())) {
                // Можна реалізувати логіку "тільки одне підключення"
                // return next(new Error("User already connected from another tab."));
            }

            const user = await prisma.user.findUnique({
                // ❗️ Використовуємо `decoded.id` (або `decoded.userId`)
                where: { id: decoded.id },
                select: { id: true, role: true }
            });

            if (!user) return next(new Error("Authentication error: User not found"));

            socket.user = user;
            next();
        } catch (err) {
            console.error("Socket auth error:", err.message);
            next(new Error("Authentication error: Invalid token"));
        }
    });

    io.on("connection", (socket) => {
        console.log(`User connected: ${socket.user.id}, Role: ${socket.user.role}`);

        // --- ПРИЄДНАННЯ ДО КІМНАТ ---
        socket.join(socket.user.role);            // Напр. 'ADMIN', 'USER'
        socket.join(`user_${socket.user.id}`);    // Персональна кімната

        // --- (Рівень 2, Пункт 4) ОНЛАЙН-СТАТУС ---
        const userIdString = socket.user.id.toString();

        // 1. Додаємо користувача до списку онлайн
        onlineUsers.set(userIdString, {
            role: socket.user.role,
            socketId: socket.id
        });

        // 2. Сповіщаємо *всіх* (включаючи адмінів), що користувач підключився
        //    'socket.broadcast' надсилає всім, *крім* поточного сокета
        socket.broadcast.emit("user:online", { userId: userIdString, role: socket.user.role });

        console.log(`User ${userIdString} is online. Total online: ${onlineUsers.size}`);
        // ------------------------------------------

        // --- (Рівень 2, Пункт 4) ОБРОБНИК ДЛЯ КЛІЄНТА ---
        // Якщо клієнт хоче отримати поточний список всіх, хто онлайн
        socket.on("users:getOnline", (callback) => {
            // Перетворюємо Map.keys() на масив рядків
            const onlineIds = Array.from(onlineUsers.keys());
            // `callback` - це функція, яку клієнт надіслав, 
            // щоб отримати відповідь
            callback(onlineIds);
        });
        // ------------------------------------------

        socket.on("disconnect", () => {
            console.log(`User disconnected: ${socket.user.id}`);

            // --- (Рівень 2, Пункт 4) ОНЛАЙН-СТАТУС ---
            // 1. Видаляємо користувача зі списку онлайн
            onlineUsers.delete(userIdString);

            // 2. Сповіщаємо *всіх*, що користувач відключився
            //    Використовуємо `io.emit`, щоб всі отримали сповіщення
            io.emit("user:offline", { userId: userIdString });

            console.log(`User ${userIdString} is offline. Total online: ${onlineUsers.size}`);
            // ------------------------------------------
        });
    });

    return io;
}

function getIO() {
    if (!io) throw new Error("Socket.IO not initialized!");
    return io;
}

module.exports = { initSocket, getIO };