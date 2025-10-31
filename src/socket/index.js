// socket.js (Виправлено)
const { Server } = require("socket.io");
const jwt = require("jsonwebtoken");
const { PrismaClient } = require("@prisma/client");

const prisma = new PrismaClient();
let io;
const onlineUsers = new Map();

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

    // --- АВТЕНТИФІКАЦІЯ (ЗАЛИШАЄМО ТІЛЬКИ ЦЮ) ---
    io.use(async (socket, next) => {
        try {
            const token = socket.handshake.auth.token;
            if (!token) return next(new Error("Authentication error: Token not provided"));

            const decoded = jwt.verify(token, process.env.JWT_SECRET);

            // --- ❗️ ВИПРАВЛЕНО ТУТ ---
            // 'decoded.id' було undefined, ми очікуємо 'userId' з токена
            const userIdFromToken = decoded.userId;

            if (!userIdFromToken) {
                return next(new Error("Authentication error: Invalid token payload (userId not found)"));
            }
            // -------------------------

            if (onlineUsers.has(userIdFromToken.toString())) {
                // ...
            }

            const user = await prisma.user.findUnique({
                // --- ❗️ І ВИКОРИСТОВУЄМО ТУТ ---
                where: { id: userIdFromToken },
                select: { id: true, role: true }
            });

            if (!user) return next(new Error("Authentication error: User not found"));

            socket.user = user;
            next();
        } catch (err) {
            console.error("Socket auth error:", err.message);
            // Помилка 'jwt malformed' або 'invalid signature' = неправильний JWT_SECRET на Render
            next(new Error("Authentication error: Invalid token"));
        }
    });

    io.on("connection", (socket) => {
        console.log(`User connected: ${socket.user.id}, Role: ${socket.user.role}`);

        socket.join(socket.user.role);
        socket.join(`user_${socket.user.id}`);
        const userIdString = socket.user.id.toString();

        onlineUsers.set(userIdString, {
            role: socket.user.role,
            socketId: socket.id
        });

        socket.broadcast.emit("user:online", { userId: userIdString, role: socket.user.role });
        console.log(`User ${userIdString} is online. Total online: ${onlineUsers.size}`);

        socket.on("users:getOnline", (callback) => {
            const onlineIds = Array.from(onlineUsers.keys());
            callback(onlineIds);
        });

        socket.on("disconnect", () => {
            console.log(`User disconnected: ${socket.user.id}`);
            onlineUsers.delete(userIdString);
            io.emit("user:offline", { userId: userIdString });
            console.log(`User ${userIdString} is offline. Total online: ${onlineUsers.size}`);
        });
    });

    return io;
}

function getIO() {
    if (!io) throw new Error("Socket.IO not initialized!");
    return io;
}

module.exports = { initSocket, getIO };