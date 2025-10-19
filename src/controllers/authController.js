const { PrismaClient } = require('@prisma/client');
const { hashPassword, comparePassword } = require('../utils/password'); // Використовуємо ваші утиліти
const { generateAccessToken, generateRefreshToken, verifyRefreshToken } = require('../utils/jwt'); // Використовуємо ваші утиліти
const crypto = require('crypto');
const sendEmail = require('../utils/email');
const prisma = new PrismaClient();

// === ФУНКЦІЇ АУТЕНТИФІКАЦІЇ (з вашого першого файлу) ===

async function register(req, res, next) {
    try {
        const { email, password, name } = req.body;

        if (!email || !password || !name) {
            return res.status(400).json({ error: 'Email, пароль та ім\'я є обов\'язковими' });
        }
        if (password.length < 8) {
            return res.status(400).json({ error: 'Пароль має містити мінімум 8 символів' });
        }

        const existingUser = await prisma.user.findUnique({ where: { email } });
        if (existingUser) {
            return res.status(409).json({ error: 'Користувач з таким email вже існує' });
        }

        const hashedPassword = await hashPassword(password);

        const user = await prisma.user.create({
            data: { email, password: hashedPassword, name },
            select: { id: true, email: true, name: true, role: true, createdAt: true }
        });

        const accessToken = generateAccessToken(user.id, user.role);
        const refreshToken = generateRefreshToken(user.id);

        res.status(201).json({
            message: 'Користувача успішно зареєстровано',
            user,
            tokens: { accessToken, refreshToken }
        });

    } catch (error) {
        console.error('Помилка реєстрації:', error);
        next(error); // Передаємо помилку далі
    }
}

async function login(req, res, next) {
    try {
        const { email, password } = req.body;

        if (!email || !password) {
            return res.status(400).json({ error: 'Email та пароль є обов\'язковими' });
        }

        const user = await prisma.user.findUnique({ where: { email } });
        if (!user) {
            return res.status(401).json({ error: 'Невірний email або пароль' });
        }

        const isPasswordValid = await comparePassword(password, user.password);
        if (!isPasswordValid) {
            return res.status(401).json({ error: 'Невірний email або пароль' });
        }

        const accessToken = generateAccessToken(user.id, user.role);
        const refreshToken = generateRefreshToken(user.id);

        const { password: _, ...userWithoutPassword } = user;

        res.json({
            message: 'Успішний вхід',
            user: userWithoutPassword,
            tokens: { accessToken, refreshToken }
        });

    } catch (error) {
        console.error('Помилка входу:', error);
        next(error);
    }
}

async function refreshToken(req, res, next) {
    try {
        const { refreshToken } = req.body;
        if (!refreshToken) {
            return res.status(400).json({ error: 'Refresh токен відсутній' });
        }

        const decoded = verifyRefreshToken(refreshToken);
        const user = await prisma.user.findUnique({ where: { id: decoded.userId } });
        if (!user) {
            return res.status(404).json({ error: 'Користувача не знайдено' });
        }

        const newAccessToken = generateAccessToken(user.id, user.role);
        const newRefreshToken = generateRefreshToken(user.id);

        res.json({
            tokens: { accessToken: newAccessToken, refreshToken: newRefreshToken }
        });

    } catch (error) {
        console.error('Помилка оновлення токену:', error);
        // Краще використовувати next для централізованої обробки помилок
        res.status(401).json({ error: 'Недійсний refresh токен' });
    }
}


const getAllUsers = async (req, res, next) => {
    try {
        const {
            page = 1,
            limit = 10,
            search,
            role,
            sortBy = 'id',
            order = 'asc'
        } = req.query;

        const skip = (parseInt(page) - 1) * parseInt(limit);

        const where = {};
        if (search) {
            where.OR = [
                { email: { contains: search, mode: 'insensitive' } },
                { name: { contains: search, mode: 'insensitive' } } // Додано пошук за ім'ям
            ];
        }
        if (role) {
            where.role = role;
        }

        const orderBy = { [sortBy]: order };

        const [users, total] = await Promise.all([
            prisma.user.findMany({
                where,
                skip,
                take: parseInt(limit),
                orderBy,
                select: { id: true, email: true, name: true, role: true, createdAt: true }
            }),
            prisma.user.count({ where })
        ]);

        res.json({
            data: users,
            pagination: {
                page: parseInt(page),
                limit: parseInt(limit),
                total,
                totalPages: Math.ceil(total / parseInt(limit)),
                hasMore: skip + users.length < total
            }
        });
    } catch (err) {
        next(err);
    }
};
async function changePassword(req, res, next) {
    try {
        // 1. Отримуємо ID користувача з токена (який додав middleware `authenticateToken`)
        const userId = req.user.userId;

        // 2. Отримуємо поточний та новий паролі з тіла запиту
        const { currentPassword, newPassword } = req.body;

        // 3. Знаходимо користувача в базі даних
        const user = await prisma.user.findUnique({
            where: { id: userId }
        });

        // Ця перевірка не обов'язкова, бо middleware вже перевірив токен, але вона додає надійності
        if (!user) {
            return res.status(404).json({ error: 'Користувача не знайдено' });
        }

        // 4. Перевіряємо, чи правильний поточний пароль
        const isPasswordValid = await comparePassword(currentPassword, user.password);
        if (!isPasswordValid) {
            return res.status(401).json({ error: 'Невірний поточний пароль' });
        }

        // 5. (Опціонально, але корисно) Перевіряємо, чи новий пароль не збігається зі старим
        if (currentPassword === newPassword) {
            return res.status(400).json({ error: 'Новий пароль не може бути таким самим, як старий' });
        }

        // 6. Хешуємо новий пароль
        const hashedNewPassword = await hashPassword(newPassword);

        // 7. Оновлюємо пароль користувача в базі даних
        await prisma.user.update({
            where: { id: userId },
            data: { password: hashedNewPassword }
        });

        res.json({ message: 'Пароль успішно оновлено' });

    } catch (error) {
        console.error('Помилка зміни пароля:', error);
        next(error); // Передаємо помилку в централізований обробник
    }
}
// NEW FUNCTION: REQUEST PASSWORD RESET
async function forgotPassword(req, res, next) {
    try {
        // 1. Find the user by email
        const user = await prisma.user.findUnique({ where: { email: req.body.email } });

        if (!user) {
            // Important: always return a success response to prevent attackers from checking if an email exists
            return res.json({ message: 'If this user exists, a password reset email has been sent.' });
        }

        // 2. Generate the reset token
        const resetToken = crypto.randomBytes(32).toString('hex');

        // 3. Hash the token and save it to the database
        const passwordResetToken = crypto.createHash('sha256').update(resetToken).digest('hex');
        const passwordResetExpires = new Date(Date.now() + 10 * 60 * 1000); // Token is valid for 10 minutes

        await prisma.user.update({
            where: { email: req.body.email },
            data: { passwordResetToken, passwordResetExpires }
        });

        // 4. Create the password reset URL and send it via email
        const resetURL = `${req.protocol}://${req.get('host')}/api/auth/reset-password/${resetToken}`;
        const message = `You received this email because you (or someone else) requested a password reset. Please click this link to set a new password: \n\n ${resetURL} \n\nIf you did not make this request, please ignore this email.`;

        await sendEmail({
            email: user.email,
            subject: 'Password Reset (valid for 10 min)',
            message
        });

        res.json({ message: 'If this user exists, a password reset email has been sent.' });

    } catch (error) {
        // In case of an error, reset the token to avoid issues
        // (add this logic if needed)
        next(error);
    }
}

// NEW FUNCTION: SET A NEW PASSWORD
async function resetPassword(req, res, next) {
    try {
        // 1. Get the token from the URL and hash it to find it in the database
        const hashedToken = crypto.createHash('sha256').update(req.params.token).digest('hex');

        // 2. Find the user by the token that has not yet expired
        const user = await prisma.user.findFirst({
            where: {
                passwordResetToken: hashedToken,
                passwordResetExpires: { gt: new Date() }
            }
        });

        if (!user) {
            return res.status(400).json({ error: 'Token is invalid or has expired' });
        }

        // 3. Set the new password
        const hashedPassword = await hashPassword(req.body.password);
        await prisma.user.update({
            where: { id: user.id },
            data: {
                password: hashedPassword,
                passwordResetToken: null, // Clear the token
                passwordResetExpires: null
            }
        });

        // 4. (Optional) Automatically log the user in
        const accessToken = generateAccessToken(user.id, user.role);
        const refreshToken = generateRefreshToken(user.id);

        res.json({ message: 'Password has been changed successfully', tokens: { accessToken, refreshToken } });

    } catch (error) {
        next(error);
    }
}

// В кінці файлу оновіть експорт, додавши нову функцію
module.exports = {
    register,
    login,
    refreshToken,
    getAllUsers,
    changePassword,
    forgotPassword,
    resetPassword
};