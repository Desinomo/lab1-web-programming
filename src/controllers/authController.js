// controllers/authController.js
const { PrismaClient } = require('@prisma/client');
const { hashPassword, comparePassword } = require('../utils/password');
const { generateAccessToken, generateRefreshToken, verifyRefreshToken } = require('../utils/jwt');
const crypto = require('crypto');
const sendEmail = require('../utils/email');
const { getIO } = require('../socket'); // 👈 Імпорт з socket

const prisma = new PrismaClient();

async function register(req, res, next) {
    try {
        const io = getIO(); // 👈 Виклик всередині функції
        const { email, password, name } = req.body;

        if (!email || !password || !name) return res.status(400).json({ error: 'Email, password, and name are required' });
        if (password.length < 8) return res.status(400).json({ error: 'Password must be at least 8 characters long' });

        const existingUser = await prisma.user.findUnique({ where: { email } });
        if (existingUser) return res.status(409).json({ error: 'User with this email already exists' });

        const hashedPassword = await hashPassword(password);
        const user = await prisma.user.create({
            data: { email, password: hashedPassword, name },
            select: { id: true, email: true, name: true, role: true, createdAt: true }
        });

        const accessToken = generateAccessToken(user.id, user.role);
        const refreshToken = generateRefreshToken(user.id);

        // Подія для адмінів, що зареєструвався новий юзер
        io.to('ADMIN').emit('user:registered', { id: user.id, email: user.email, name: user.name, role: user.role });

        res.status(201).json({ message: 'User registered successfully', user, tokens: { accessToken, refreshToken } });
    } catch (error) {
        if (error.code === 'P2002' && error.meta?.target?.includes('email')) return res.status(409).json({ error: 'User with this email already exists' });
        next(error);
    }
}

async function login(req, res, next) {
    try {
        const io = getIO(); // 👈 Виклик всередині функції
        const { email, password } = req.body;
        if (!email || !password) return res.status(400).json({ error: 'Email and password are required' });

        const user = await prisma.user.findUnique({ where: { email } });
        if (!user) return res.status(401).json({ error: 'Invalid email or password' });

        const isPasswordValid = await comparePassword(password, user.password);
        if (!isPasswordValid) return res.status(401).json({ error: 'Invalid email or password' });

        const accessToken = generateAccessToken(user.id, user.role);
        const refreshToken = generateRefreshToken(user.id);

        const { password: _, ...userWithoutPassword } = user;

        // Повідомляємо адмінів, що хтось залогінився
        io.to('ADMIN').emit('user:loggedin', { userId: user.id, email: user.email, name: user.name, role: user.role });

        res.json({ message: 'Login successful', user: userWithoutPassword, tokens: { accessToken, refreshToken } });
    } catch (error) {
        next(error);
    }
}

async function refreshToken(req, res, next) {
    try {
        const { refreshToken: providedRefreshToken } = req.body;
        if (!providedRefreshToken) return res.status(400).json({ error: 'Refresh token is missing' });

        const decoded = verifyRefreshToken(providedRefreshToken);
        const user = await prisma.user.findUnique({ where: { id: decoded.userId } });
        if (!user) return res.status(401).json({ error: 'Invalid refresh token: user not found' });

        const newAccessToken = generateAccessToken(user.id, user.role);
        const newRefreshToken = generateRefreshToken(user.id);

        res.json({ tokens: { accessToken: newAccessToken, refreshToken: newRefreshToken } });
    } catch (error) {
        res.status(401).json({ error: 'Invalid or expired refresh token' });
    }
}

const getAllUsers = async (req, res, next) => {
    try {
        // 'io' тут не потрібен
        const { page = 1, limit = 10, search, role, sortBy = 'id', order = 'asc' } = req.query;
        const skip = (parseInt(page) - 1) * parseInt(limit);

        const where = {};
        if (search) where.OR = [{ email: { contains: search, mode: 'insensitive' } }, { name: { contains: search, mode: 'insensitive' } }];
        if (role) where.role = role.toUpperCase();

        const validSortFields = ['id', 'email', 'name', 'role', 'createdAt'];
        const safeSortBy = validSortFields.includes(sortBy) ? sortBy : 'id';
        const orderBy = { [safeSortBy]: order };

        const [users, total] = await Promise.all([
            prisma.user.findMany({ where, skip, take: parseInt(limit), orderBy, select: { id: true, email: true, name: true, role: true, createdAt: true } }),
            prisma.user.count({ where })
        ]);

        res.json({ data: users, pagination: { page: parseInt(page), limit: parseInt(limit), total, totalPages: Math.ceil(total / parseInt(limit)), hasMore: skip + users.length < total } });
    } catch (err) { next(err); }
};

async function changePassword(req, res, next) {
    try {
        // 'io' тут не потрібен
        const userId = req.user.userId;
        const { currentPassword, newPassword } = req.body;

        if (!currentPassword || !newPassword) return res.status(400).json({ error: 'Current and new passwords are required' });
        if (newPassword.length < 8) return res.status(400).json({ error: 'New password must be at least 8 characters long' });
        if (currentPassword === newPassword) return res.status(400).json({ error: 'New password cannot be the same as the old one' });

        const user = await prisma.user.findUnique({ where: { id: userId } });
        if (!user) return res.status(404).json({ error: 'User not found' });

        const isPasswordValid = await comparePassword(currentPassword, user.password);
        if (!isPasswordValid) return res.status(401).json({ error: 'Incorrect current password' });

        const hashedNewPassword = await hashPassword(newPassword);
        await prisma.user.update({ where: { id: userId }, data: { password: hashedNewPassword } });

        res.json({ message: 'Password updated successfully' });
    } catch (error) { next(error); }
}

async function forgotPassword(req, res, next) {
    try {
        // 'io' тут не потрібен
        const { email } = req.body;
        if (!email) return res.status(400).json({ error: 'Email is required' });

        const user = await prisma.user.findUnique({ where: { email } });
        if (!user) return res.json({ message: 'If this user exists, a password reset email has been sent.' });

        const resetToken = crypto.randomBytes(32).toString('hex');
        const passwordResetToken = crypto.createHash('sha256').update(resetToken).digest('hex');
        const passwordResetExpires = new Date(Date.now() + 10 * 60 * 1000); // 10 хвилин

        await prisma.user.update({ where: { email: user.email }, data: { passwordResetToken, passwordResetExpires } });

        const resetURL = `${process.env.FRONTEND_URL}/reset-password/${resetToken}`;
        const message = `Click this link to reset your password: ${resetURL} (valid 10 min)`;

        try {
            await sendEmail({ email: user.email, subject: 'Password Reset Request', message });
            res.json({ message: 'If this user exists, a password reset email has been sent.' });
        } catch (emailError) {
            await prisma.user.update({ where: { email: user.email }, data: { passwordResetToken: null, passwordResetExpires: null } });
            return next(new Error('Failed to send password reset email.'));
        }
    } catch (error) { next(error); }
}

async function resetPassword(req, res, next) {
    try {
        // 'io' тут не потрібен
        const { token } = req.params;
        const { password } = req.body;
        if (!password || password.length < 8) return res.status(400).json({ error: 'Password must be at least 8 characters long' });

        const hashedToken = crypto.createHash('sha256').update(token).digest('hex');
        const user = await prisma.user.findFirst({ where: { passwordResetToken: hashedToken, passwordResetExpires: { gt: new Date() } } });
        if (!user) return res.status(400).json({ error: 'Token is invalid or expired' });

        const hashedPassword = await hashPassword(password);
        await prisma.user.update({ where: { id: user.id }, data: { password: hashedPassword, passwordResetToken: null, passwordResetExpires: null } });

        res.json({ message: 'Password has been changed successfully.' });
    } catch (error) { next(error); }
}

module.exports = { register, login, refreshToken, getAllUsers, changePassword, forgotPassword, resetPassword };