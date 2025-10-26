// src/socket/index.js
const { Server } = require("socket.io"); // ��������� ���� Server � ��������

let io; // ����� ��� ��������� ���������� Socket.IO �������

// ������� ��� ����������� Socket.IO
function initSocket(httpServer) {
    io = new Server(httpServer, {
        cors: {
            origin: process.env.FRONTEND_URL || "http://localhost:5173", // ���������� �'������� � ������ ���������
            methods: ["GET", "POST"],
            credentials: true
        }
    });

    console.log("Socket.IO initialized");

    // ������� ����� ���������
    io.on('connection', (socket) => {
        console.log('A user connected:', socket.id); // ������ ID ������ �'�������

        // ������� ����������
        socket.on('disconnect', () => {
            console.log('User disconnected:', socket.id);
        });

        // ��� ������ ���� ��������� ����...
        socket.on('joinRoom', (roomName) => {
            socket.join(roomName); // �������� ����� �� ������
            console.log(`Socket ${socket.id} joined room ${roomName}`);
        });

        socket.on('leaveRoom', (roomName) => {
            socket.leave(roomName); // ³�'������ ����� �� ������
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