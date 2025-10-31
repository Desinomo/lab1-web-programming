// controllers/fileController.js
const { PrismaClient } = require('@prisma/client');
const fs = require('fs').promises;
const path = require('path');
const { getIO } = require('../socket'); // 👈 Імпорт з socket

const prisma = new PrismaClient();
// 👈 Видалено 'const io = getIO()' звідси

const uploadFile = async (req, res, next) => {
    try {
        const io = getIO(); // 👈 Виклик всередині
        if (!req.file) return res.status(400).json({ error: 'File not provided' });

        const fileData = {
            filename: req.file.filename,
            originalName: req.file.originalname,
            mimetype: req.file.mimetype,
            size: req.file.size,
            path: req.file.path, // Увага: це буде працювати некоректно на Render
            uploadedBy: req.user.userId
        };

        const file = await prisma.file.create({ data: fileData });

        io.to('ADMIN').to('MODERATOR').emit('file:uploaded', file);
        // Сповіщення тільки для адмінів/модераторів
        io.to('ADMIN').to('MODERATOR').emit('notification:new', { type: 'info', message: `New file uploaded: ${file.originalName}`, fileId: file.id });

        res.status(201).json({ message: 'File uploaded successfully', file });
    } catch (err) {
        if (req.file) await fs.unlink(req.file.path).catch(console.error);
        next(err);
    }
};

const getFile = async (req, res, next) => {
    try {
        const fileId = parseInt(req.params.id);
        const file = await prisma.file.findUnique({ where: { id: fileId } });
        if (!file) return res.status(404).json({ error: 'File not found' });

        // 👈 ВИПРАВЛЕНО: res.sendFile не буде працювати на Render
        // Повертаємо JSON, а не сам файл, оскільки файлова система Render ефемерна.
        res.json(file);

    } catch (err) { next(err); }
};

const deleteFile = async (req, res, next) => {
    try {
        const io = getIO(); // 👈 Виклик всередині
        const fileId = parseInt(req.params.id);
        const file = await prisma.file.findUnique({ where: { id: fileId } });
        if (!file) return res.status(404).json({ error: 'File not found' });

        if (file.uploadedBy !== req.user.userId && req.user.role !== 'ADMIN') {
            return res.status(403).json({ error: 'Insufficient permissions to delete this file' });
        }

        await prisma.file.delete({ where: { id: fileId } });
        await fs.unlink(file.path).catch(console.error); // Спробуємо видалити, але не ламаємося, якщо не вийде

        io.to('ADMIN').to('MODERATOR').emit('file:deleted', { id: fileId });
        io.to('ADMIN').to('MODERATOR').emit('notification:new', { type: 'warning', message: `File deleted: ${file.originalName}`, fileId: file.id });

        res.status(200).json({ message: 'File deleted successfully' });
    } catch (err) {
        if (err.code === 'P2025') return res.status(404).json({ error: "File not found for deletion" });
        next(err);
    }
};

module.exports = { uploadFile, getFile, deleteFile };