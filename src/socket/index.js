// socket/index.js
const { Server } = require("socket.io");
const jwt = require('jsonwebtoken');
const { PrismaClient } = require('@prisma/client'); // ������� ��� �������� �����������

const prisma = new PrismaClient();
let io; // ����� ��� ��������� ���������� Socket.IO �������

// ������� ��� ����������� Socket.IO
function initSocket(httpServer) {
    io = new Server(httpServer, {
        cors: {
            origin: process.env.FRONTEND_URL || "http://localhost:5173",
            methods: ["GET", "POST"],
            credentials: true
        }
    });

    console.log("Socket.IO initialized");

    // --- �������Բ��ֲ� ������ (г���� 2, ��� ������� ��� �����) ---
    // �� middleware, ��� ����������� ��� *�������* ������ �����-�'�������
    io.use(async (socket, next) => {
        try {
            // �볺�� �� �������� ����� ��� ���������
            const token = socket.handshake.auth.token;

            if (!token) {
                return next(new Error('Authentication error: Token not provided'));
            }

            // ���������� �����
            const decoded = jwt.verify(token, process.env.JWT_SECRET);

            // ��������� ����������� � ��
            const user = await prisma.user.findUnique({
                where: { id: decoded.userId },
                select: { id: true, role: true }
            });

            if (!user) {
                return next(new Error('Authentication error: User not found'));
            }

            // �������� ��� ��� ����������� � ������ ��'��� ������
            socket.user = user;
            next(); // ���������� ����������

        } catch (err) {
            console.error("Socket auth error:", err.message);
            next(new Error('Authentication error: Invalid token'));
        }
    });


    // ������� ����� ��������� (���� ��������������)
    io.on('connection', (socket) => {
        // ����� �� ���� ������ �� socket.user
        console.log(`A user connected: ${socket.id}, Role: ${socket.user.role}`);

        // --- 3. ������� ʲ���� (г���� 1) ---
        // ����������� �������� ����������� �� ������ �� ����� ���� ���
        socket.join(socket.user.role); // ����. ������ 'ADMIN', 'MODERATOR', 'USER'

        // ����� �������� �� ����������� ������ (��� �������� ��������� ��������)
        socket.join(`user_${socket.user.id}`);

        console.log(`Socket ${socket.id} joined rooms: '${socket.user.role}' and 'user_${socket.user.id}'`);

        // ������� ����������
        socket.on('disconnect', () => {
            console.log('User disconnected:', socket.id);
        });

        // �� ������ �������� �� ���������, ���� ���� ��� �� ������
        socket.on('joinRoom', (roomName) => {
            socket.join(roomName);
            console.log(`Socket ${socket.id} joined room ${roomName}`);
        });

        socket.on('leaveRoom', (roomName) => {
            socket.leave(roomName);
            console.log(`Socket ${socket.id} left room ${roomName}`);
        });

    });

    return io; // ��������� ������������� ��������� io
}

// ������� ��� ��������� ���������� io (��� ��������������� � �����������)
function getIO() {
    if (!io) {
        throw new Error("Socket.IO not initialized!");
    }
    return io;
}

module.exports = { initSocket, getIO }; // ���������� �������