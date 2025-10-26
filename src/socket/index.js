// src/socket/index.js
const { Server } = require("socket.io"); // Імпортуємо клас Server з бібліотеки

let io; // Змінна для зберігання екземпляру Socket.IO сервера

// Функція для ініціалізації Socket.IO
function initSocket(httpServer) {
    io = new Server(httpServer, {
        cors: {
            origin: process.env.FRONTEND_URL || "http://localhost:5173", // Дозволяємо з'єднання з вашого фронтенду
            methods: ["GET", "POST"],
            credentials: true
        }
    });

    console.log("Socket.IO initialized");

    // Обробка нових підключень
    io.on('connection', (socket) => {
        console.log('A user connected:', socket.id); // Логуємо ID нового з'єднання

        // Обробка відключення
        socket.on('disconnect', () => {
            console.log('User disconnected:', socket.id);
        });

        // Тут будуть інші обробники подій...
        socket.on('joinRoom', (roomName) => {
            socket.join(roomName); // Приєднуємо сокет до кімнати
            console.log(`Socket ${socket.id} joined room ${roomName}`);
        });

        socket.on('leaveRoom', (roomName) => {
            socket.leave(roomName); // Від'єднуємо сокет від кімнати
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