const { PrismaClient } = require('@prisma/client');
const { hashPassword, comparePassword } = require('../utils/password');
const { generateAccessToken, generateRefreshToken, verifyRefreshToken } = require('../utils/jwt');
const crypto = require('crypto');
const sendEmail = require('../utils/email');
const { getIO } = require('../socket'); // 1. Import getIO

const prisma = new PrismaClient();

// Get io instance with error handling
let io;
try {
    io = getIO(); // 2. Get io instance
} catch (error) {
    console.error("Failed to get Socket.IO instance in authController.", error);
    // Fallback to prevent crashes if io is not ready
    io = { emit: () => console.warn("Socket.IO not ready in authController.") };
}

// === AUTHENTICATION FUNCTIONS ===

async function register(req, res, next) {
    try {
        const { email, password, name } = req.body;

        // Basic validation
        if (!email || !password || !name) {
            return res.status(400).json({ error: 'Email, password, and name are required' });
        }
        if (password.length < 8) {
            return res.status(400).json({ error: 'Password must be at least 8 characters long' });
        }

        const existingUser = await prisma.user.findUnique({ where: { email } });
        if (existingUser) {
            return res.status(409).json({ error: 'User with this email already exists' });
        }

        const hashedPassword = await hashPassword(password);

        const user = await prisma.user.create({
            data: { email, password: hashedPassword, name },
            // Select only necessary fields for the response
            select: { id: true, email: true, name: true, role: true, createdAt: true }
        });

        const accessToken = generateAccessToken(user.id, user.role);
        const refreshToken = generateRefreshToken(user.id);

        // 3. Emit event about new user registration (send safe data)
        io.emit('user:registered', { id: user.id, email: user.email, name: user.name, role: user.role });

        res.status(201).json({
            message: 'User registered successfully',
            user,
            tokens: { accessToken, refreshToken }
        });

    } catch (error) {
        // Handle potential unique constraint errors if validation misses something
        if (error.code === 'P2002' && error.meta?.target?.includes('email')) {
            return res.status(409).json({ error: 'User with this email already exists' });
        }
        next(error); // Pass other errors to the central handler
    }
}

async function login(req, res, next) {
    try {
        const { email, password } = req.body;

        if (!email || !password) {
            return res.status(400).json({ error: 'Email and password are required' });
        }

        const user = await prisma.user.findUnique({ where: { email } });
        if (!user) {
            return res.status(401).json({ error: 'Invalid email or password' });
        }

        const isPasswordValid = await comparePassword(password, user.password);
        if (!isPasswordValid) {
            return res.status(401).json({ error: 'Invalid email or password' });
        }

        const accessToken = generateAccessToken(user.id, user.role);
        const refreshToken = generateRefreshToken(user.id);

        // Exclude password from the user object sent in the response
        const { password: _, ...userWithoutPassword } = user;

        // 4. Emit event about successful login (send safe data)
        // Consider emitting only to admin/moderator roles if needed
        io.emit('user:loggedin', { userId: user.id, email: user.email, name: user.name, role: user.role });

        res.json({
            message: 'Login successful',
            user: userWithoutPassword,
            tokens: { accessToken, refreshToken }
        });

    } catch (error) {
        next(error);
    }
}

async function refreshToken(req, res, next) {
    try {
        const { refreshToken: providedRefreshToken } = req.body;
        if (!providedRefreshToken) {
            return res.status(400).json({ error: 'Refresh token is missing' });
        }

        const decoded = verifyRefreshToken(providedRefreshToken);
        // Ensure user still exists
        const user = await prisma.user.findUnique({ where: { id: decoded.userId } });
        if (!user) {
            // Important: Do not issue new tokens if user was deleted
            return res.status(401).json({ error: 'Invalid refresh token: user not found' });
        }

        const newAccessToken = generateAccessToken(user.id, user.role);
        const newRefreshToken = generateRefreshToken(user.id); // Re-issue refresh token (best practice)

        res.json({
            tokens: { accessToken: newAccessToken, refreshToken: newRefreshToken }
        });

    } catch (error) {
        // Handle token verification errors
        res.status(401).json({ error: 'Invalid or expired refresh token' });
    }
}

// === ADMINISTRATION FUNCTION ===
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
                { name: { contains: search, mode: 'insensitive' } }
            ];
        }
        if (role) {
            const validRoles = ["USER", "ADMIN", "MODERATOR"]; // Match your Prisma enum
            if (validRoles.includes(role.toUpperCase())) {
                where.role = role.toUpperCase();
            } else {
                console.warn(`Invalid role requested in getAllUsers: ${role}`);
            }
        }

        const validSortFields = ['id', 'email', 'name', 'role', 'createdAt'];
        const safeSortBy = validSortFields.includes(sortBy) ? sortBy : 'id';
        const orderBy = { [safeSortBy]: order };


        const [users, total] = await Promise.all([
            prisma.user.findMany({
                where,
                skip,
                take: parseInt(limit),
                orderBy,
                select: { id: true, email: true, name: true, role: true, createdAt: true } // Select safe fields
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

// === PASSWORD MANAGEMENT FUNCTIONS ===
async function changePassword(req, res, next) {
    try {
        const userId = req.user.userId; // Get user ID from authenticated token
        const { currentPassword, newPassword } = req.body;

        // Validation
        if (!currentPassword || !newPassword) {
            return res.status(400).json({ error: 'Current and new passwords are required' });
        }
        if (newPassword.length < 8) {
            return res.status(400).json({ error: 'New password must be at least 8 characters long' });
        }
        if (currentPassword === newPassword) {
            return res.status(400).json({ error: 'New password cannot be the same as the old one' });
        }

        const user = await prisma.user.findUnique({ where: { id: userId } });
        if (!user) {
            // Should not happen if authenticateToken works, but good practice
            return res.status(404).json({ error: 'User not found' });
        }

        const isPasswordValid = await comparePassword(currentPassword, user.password);
        if (!isPasswordValid) {
            return res.status(401).json({ error: 'Incorrect current password' });
        }

        const hashedNewPassword = await hashPassword(newPassword);

        await prisma.user.update({
            where: { id: userId },
            data: { password: hashedNewPassword }
        });

        // 5. Emit event about password change (maybe only to the user's specific socket?)
        // io.to(userSocketId).emit('user:passwordChanged', { userId: user.id }); // Needs socket ID mapping

        res.json({ message: 'Password updated successfully' });

    } catch (error) {
        next(error);
    }
}

async function forgotPassword(req, res, next) {
    try {
        const { email } = req.body;
        if (!email) {
            return res.status(400).json({ error: 'Email is required' });
        }

        const user = await prisma.user.findUnique({ where: { email } });

        if (!user) {
            // Security best practice: don't reveal if email exists
            return res.json({ message: 'If this user exists, a password reset email has been sent.' });
        }

        const resetToken = crypto.randomBytes(32).toString('hex');
        const passwordResetToken = crypto.createHash('sha256').update(resetToken).digest('hex');
        const passwordResetExpires = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes validity

        await prisma.user.update({
            where: { email: user.email }, // Use user's email for reliability
            data: { passwordResetToken, passwordResetExpires }
        });

        // Use FRONTEND_URL for the link
        const resetURL = `${process.env.FRONTEND_URL}/reset-password/${resetToken}`; // Ensure FRONTEND_URL is in .env
        const message = `You received this email because you (or someone else) requested a password reset. Please click this link to set a new password: \n\n ${resetURL} \n\nThis link is valid for 10 minutes. \n\nIf you did not make this request, please ignore this email.`;

        try {
            await sendEmail({
                email: user.email,
                subject: 'Password Reset Request (valid for 10 min)',
                message
            });
            res.json({ message: 'If this user exists, a password reset email has been sent.' });
        } catch (emailError) {
            console.error('Email sending error in forgotPassword:', emailError);
            // Important: Reset token if email fails to send
            await prisma.user.update({
                where: { email: user.email },
                data: { passwordResetToken: null, passwordResetExpires: null }
            }).catch(dbError => console.error("Failed to reset token after email error:", dbError)); // Log DB error too
            // Return a generic error to the user
            return next(new Error('Failed to send password reset email. Please try again later.'));
        }

    } catch (error) {
        next(error);
    }
}

async function resetPassword(req, res, next) {
    try {
        const { token } = req.params;
        const { password } = req.body;

        if (!password || password.length < 8) {
            return res.status(400).json({ error: 'Password must be at least 8 characters long' });
        }

        const hashedToken = crypto.createHash('sha256').update(token).digest('hex');

        // Find user by hashed token and check expiry date
        const user = await prisma.user.findFirst({
            where: {
                passwordResetToken: hashedToken,
                passwordResetExpires: { gt: new Date() } // Check if token is still valid
            }
        });

        if (!user) {
            return res.status(400).json({ error: 'Token is invalid or has expired' });
        }

        const hashedPassword = await hashPassword(password);
        await prisma.user.update({
            where: { id: user.id },
            data: {
                password: hashedPassword,
                passwordResetToken: null, // Clear token after successful use
                passwordResetExpires: null
            }
        });

        // Security best practice: don't automatically log in after reset
        res.json({ message: 'Password has been changed successfully. Please log in with your new password.' });

    } catch (error) {
        next(error);
    }
}


module.exports = {
    register,
    login,
    refreshToken,
    getAllUsers,
    changePassword,
    forgotPassword,
    resetPassword
};