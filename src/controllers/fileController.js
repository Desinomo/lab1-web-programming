const { PrismaClient } = require('@prisma/client');
const fs = require('fs').promises;
const path = require('path');

const prisma = new PrismaClient();

async function uploadFile(req, res) {
    try {
        if (!req.file) {
            return res.status(400).json({
                error: '���� �� ������'
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
            message: '���� ������ �����������',
            file
        });

    } catch (error) {
        console.error('������� ������������ �����:', error);

        if (req.file) {
            await fs.unlink(req.file.path).catch(console.error);
        }

        res.status(500).json({
            error: '������� ������� ��� ����������� �����'
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
                error: '���� �� ��������'
            });
        }

        res.sendFile(path.resolve(file.path));

    } catch (error) {
        console.error('������� ��������� �����:', error);
        res.status(500).json({
            error: '������� �������'
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
                error: '���� �� ��������'
            });
        }

        if (file.uploadedBy !== req.user.userId && req.user.role !== 'ADMIN') {
            return res.status(403).json({
                error: '�� �� ���� ���� ��� ��������� ����� �����'
            });
        }

        await fs.unlink(file.path);

        await prisma.file.delete({
            where: { id: fileId }
        });

        res.json({
            message: '���� ������ ��������'
        });

    } catch (error) {
        console.error('������� ��������� �����:', error);
        res.status(500).json({
            error: '������� ������� ��� �������� �����'
        });
    }
}

module.exports = {
    uploadFile,
    getFile,
    deleteFile
};