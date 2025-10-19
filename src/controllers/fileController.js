const { PrismaClient } = require('@prisma/client');
const fs = require('fs').promises;
const path = require('path');

const prisma = new PrismaClient();

async function uploadFile(req, res) {
    try {
        if (!req.file) {
            return res.status(400).json({
                error: 'Файл не надано'
            });
        }

        const file = await prisma.file.create({
            data: {
                filename: req.file.filename,
                originalName: req.file.originalname,
                mimetype: req.file.mimetype,
                size: req.file.size,
                path: req.file.path,
                uploadedBy: req.user.userId
            }
        });

        res.status(201).json({
            message: 'Файл успішно завантажено',
            file
        });

    } catch (error) {
        console.error('Помилка завантаження файлу:', error);

        if (req.file) {
            await fs.unlink(req.file.path).catch(console.error);
        }

        res.status(500).json({
            error: 'Помилка сервера при завантаженні файлу'
        });
    }
}

async function getFile(req, res) {
    try {
        const fileId = parseInt(req.params.id);

        const file = await prisma.file.findUnique({
            where: { id: fileId }
        });

        if (!file) {
            return res.status(404).json({
                error: 'Файл не знайдено'
            });
        }

        res.sendFile(path.resolve(file.path));

    } catch (error) {
        console.error('Помилка отримання файлу:', error);
        res.status(500).json({
            error: 'Помилка сервера'
        });
    }
}

async function deleteFile(req, res) {
    try {
        const fileId = parseInt(req.params.id);

        const file = await prisma.file.findUnique({
            where: { id: fileId }
        });

        if (!file) {
            return res.status(404).json({
                error: 'Файл не знайдено'
            });
        }

        if (file.uploadedBy !== req.user.userId && req.user.role !== 'ADMIN') {
            return res.status(403).json({
                error: 'Ви не маєте прав для видалення цього файлу'
            });
        }

        await fs.unlink(file.path);

        await prisma.file.delete({
            where: { id: fileId }
        });

        res.json({
            message: 'Файл успішно видалено'
        });

    } catch (error) {
        console.error('Помилка видалення файлу:', error);
        res.status(500).json({
            error: 'Помилка сервера при видаленні файлу'
        });
    }
}

module.exports = {
    uploadFile,
    getFile,
    deleteFile
};