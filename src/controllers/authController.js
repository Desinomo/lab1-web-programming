const { PrismaClient } = require('@prisma/client');
const { hashPassword, comparePassword } = require('../utils/password'); // ������������� ���� ������
const { generateAccessToken, generateRefreshToken, verifyRefreshToken } = require('../utils/jwt'); // ������������� ���� ������
const crypto = require('crypto');
const sendEmail = require('../utils/email');
const prisma = new PrismaClient();

// === ����ֲ� �������Բ��ֲ� (� ������ ������� �����) ===

async function register(req, res, next) {
    try {
        const { email, password, name } = req.body;

        if (!email || !password || !name) {
            return res.status(400).json({ error: 'Email, ������ �� ��\'� � ����\'��������' });
        }
        if (password.length < 8) {
            return res.status(400).json({ error: '������ �� ������ ����� 8 �������' });
        }

        const existingUser = await prisma.user.findUnique({ where: { email } });
        if (existingUser) {
            return res.status(409).json({ error: '���������� � ����� email ��� ����' });
        }

        const hashedPassword = await hashPassword(password);

        const user = await prisma.user.create({
            data: { email, password: hashedPassword, name },
            select: { id: true, email: true, name: true, role: true, createdAt: true }
        });

        const accessToken = generateAccessToken(user.id, user.role);
        const refreshToken = generateRefreshToken(user.id);

        res.status(201).json({
            message: '����������� ������ ������������',
            user,
            tokens: { accessToken, refreshToken }
        });

    } catch (error) {
        console.error('������� ���������:', error);
        next(error); // �������� ������� ���
    }
}

async function login(req, res, next) {
    try {
        const { email, password } = req.body;

        if (!email || !password) {
            return res.status(400).json({ error: 'Email �� ������ � ����\'��������' });
        }

        const user = await prisma.user.findUnique({ where: { email } });
        if (!user) {
            return res.status(401).json({ error: '������� email ��� ������' });
        }

        const isPasswordValid = await comparePassword(password, user.password);
        if (!isPasswordValid) {
            return res.status(401).json({ error: '������� email ��� ������' });
        }

        const accessToken = generateAccessToken(user.id, user.role);
        const refreshToken = generateRefreshToken(user.id);

        const { password: _, ...userWithoutPassword } = user;

        res.json({
            message: '������� ����',
            user: userWithoutPassword,
            tokens: { accessToken, refreshToken }
        });

    } catch (error) {
        console.error('������� �����:', error);
        next(error);
    }
}

async function refreshToken(req, res, next) {
    try {
        const { refreshToken } = req.body;
        if (!refreshToken) {
            return res.status(400).json({ error: 'Refresh ����� �������' });
        }

        const decoded = verifyRefreshToken(refreshToken);
        const user = await prisma.user.findUnique({ where: { id: decoded.userId } });
        if (!user) {
            return res.status(404).json({ error: '����������� �� ��������' });
        }

        const newAccessToken = generateAccessToken(user.id, user.role);
        const newRefreshToken = generateRefreshToken(user.id);

        res.json({
            tokens: { accessToken: newAccessToken, refreshToken: newRefreshToken }
        });

    } catch (error) {
        console.error('������� ��������� ������:', error);
        // ����� ��������������� next ��� ������������� ������� �������
        res.status(401).json({ error: '�������� refresh �����' });
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
                { name: { contains: search, mode: 'insensitive' } } // ������ ����� �� ��'��
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
        // 1. �������� ID ����������� � ������ (���� ����� middleware `authenticateToken`)
        const userId = req.user.userId;

        // 2. �������� �������� �� ����� ����� � ��� ������
        const { currentPassword, newPassword } = req.body;

        // 3. ��������� ����������� � ��� �����
        const user = await prisma.user.findUnique({
            where: { id: userId }
        });

        // �� �������� �� ����'������, �� middleware ��� �������� �����, ��� ���� ���� ��������
        if (!user) {
            return res.status(404).json({ error: '����������� �� ��������' });
        }

        // 4. ����������, �� ���������� �������� ������
        const isPasswordValid = await comparePassword(currentPassword, user.password);
        if (!isPasswordValid) {
            return res.status(401).json({ error: '������� �������� ������' });
        }

        // 5. (�����������, ��� �������) ����������, �� ����� ������ �� �������� � ������
        if (currentPassword === newPassword) {
            return res.status(400).json({ error: '����� ������ �� ���� ���� ����� �����, �� ������' });
        }

        // 6. ������ ����� ������
        const hashedNewPassword = await hashPassword(newPassword);

        // 7. ��������� ������ ����������� � ��� �����
        await prisma.user.update({
            where: { id: userId },
            data: { password: hashedNewPassword }
        });

        res.json({ message: '������ ������ ��������' });

    } catch (error) {
        console.error('������� ���� ������:', error);
        next(error); // �������� ������� � �������������� ��������
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

// � ���� ����� ������ �������, ������� ���� �������
module.exports = {
    register,
    login,
    refreshToken,
    getAllUsers,
    changePassword,
    forgotPassword,
    resetPassword
};