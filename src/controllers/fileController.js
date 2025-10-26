const { PrismaClient } = require('@prisma/client');
const fs = require('fs').promises;
const path = require('path');
const { getIO } = require('../socket');

const prisma = new PrismaClient();

const uploadFile = async (req, res, next) => {
    try {
        const io = getIO();
        if (!req.file) return res.status(400).json({ error: 'File not provided' });

        const fileData = {
            filename: req.file.filename,
            originalName: req.file.originalname,
            mimetype: req.file.mimetype,
            size: req.file.size,
            path: req.file.path,
            uploadedBy: req.user.userId
        };

        const file = await prisma.file.create({ data: fileData });

        io.emit('file:uploaded', file);
        io.emit('notification:new', { type: 'info', message: `New file uploaded: ${file.originalName}`, fileId: file.id });

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
        res.sendFile(path.resolve(file.path));
    } catch (err) { next(err); }
};

const deleteFile = async (req, res, next) => {
    try {
        const io = getIO();
        const fileId = parseInt(req.params.id);
        const file = await prisma.file.findUnique({ where: { id: fileId } });
        if (!file) return res.status(404).json({ error: 'File not found' });

        if (file.uploadedBy !== req.user.userId && req.user.role !== 'ADMIN') {
            return res.status(403).json({ error: 'Insufficient permissions to delete this file' });
        }

        await prisma.file.delete({ where: { id: fileId } });
        await fs.unlink(file.path).catch(console.error);

        io.emit('file:deleted', { id: fileId });
        io.emit('notification:new', { type: 'warning', message: `File deleted: ${file.originalName}`, fileId: file.id });

        res.status(200).json({ message: 'File deleted successfully' });
    } catch (err) {
        if (err.code === 'P2025') return res.status(404).json({ error: "File not found for deletion" });
        next(err);
    }
};

module.exports = { uploadFile, getFile, deleteFile };
