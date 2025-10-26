const { PrismaClient } = require("@prisma/client");
const { hashPassword, comparePassword } = require("../utils/password");
const { generateAccessToken, generateRefreshToken, verifyRefreshToken } = require("../utils/jwt");
const { getIO, getUserSocket } = require("../socket");
const Joi = require("joi");

const prisma = new PrismaClient();
let io;
try {
    io = getIO();
} catch {
    io = { emit: () => console.warn("Socket.IO not ready") };
}

// --- Joi Schemas ---
const registerSchema = Joi.object({
    email: Joi.string().email().required(),
    password: Joi.string().min(8).required(),
    name: Joi.string().min(2).required()
});

const loginSchema = Joi.object({
    email: Joi.string().email().required(),
    password: Joi.string().required()
});

const changePasswordSchema = Joi.object({
    currentPassword: Joi.string().required(),
    newPassword: Joi.string().min(8).required()
});

const refreshTokenSchema = Joi.object({
    refreshToken: Joi.string().required()
});

// --- REGISTER ---
async function register(req, res, next) {
    try {
        const { error } = registerSchema.validate(req.body);
        if (error) return res.status(400).json({ error: error.details[0].message });

        const { email, password, name } = req.body;

        const existingUser = await prisma.user.findUnique({ where: { email } });
        if (existingUser) return res.status(409).json({ error: "User exists" });

        const hashedPassword = await hashPassword(password);
        const user = await prisma.user.create({
            data: { email, password: hashedPassword, name },
            select: { id: true, email: true, name: true, role: true, createdAt: true }
        });

        const accessToken = generateAccessToken(user.id, user.role);
        const refreshToken = generateRefreshToken(user.id);

        io.emit("user:registered", user);

        res.status(201).json({ message: "User registered", user, tokens: { accessToken, refreshToken } });
    } catch (err) {
        if (err.code === "P2002") return res.status(409).json({ error: "User exists" });
        next(err);
    }
}

// --- LOGIN ---
async function login(req, res, next) {
    try {
        const { error } = loginSchema.validate(req.body);
        if (error) return res.status(400).json({ error: error.details[0].message });

        const { email, password } = req.body;
        const user = await prisma.user.findUnique({ where: { email } });
        if (!user || !(await comparePassword(password, user.password)))
            return res.status(401).json({ error: "Invalid credentials" });

        const accessToken = generateAccessToken(user.id, user.role);
        const refreshToken = generateRefreshToken(user.id);

        const { password: _, ...userSafe } = user;
        io.emit("user:loggedin", userSafe);

        res.json({ message: "Login successful", user: userSafe, tokens: { accessToken, refreshToken } });
    } catch (err) {
        next(err);
    }
}

// --- CHANGE PASSWORD ---
async function changePassword(req, res, next) {
    try {
        const { error } = changePasswordSchema.validate(req.body);
        if (error) return res.status(400).json({ error: error.details[0].message });

        const userId = req.user.userId;
        const { currentPassword, newPassword } = req.body;

        const user = await prisma.user.findUnique({ where: { id: userId } });
        if (!user) return res.status(404).json({ error: "User not found" });
        if (!(await comparePassword(currentPassword, user.password)))
            return res.status(401).json({ error: "Wrong current password" });

        const hashedNewPassword = await hashPassword(newPassword);
        await prisma.user.update({ where: { id: userId }, data: { password: hashedNewPassword } });

        const socketId = getUserSocket(userId);
        if (socketId) io.to(socketId).emit("user:passwordChanged", { userId });

        res.json({ message: "Password updated" });
    } catch (err) {
        next(err);
    }
}

// --- REFRESH TOKEN ---
async function refreshToken(req, res, next) {
    try {
        const { error } = refreshTokenSchema.validate(req.body);
        if (error) return res.status(400).json({ error: error.details[0].message });

        const { refreshToken: token } = req.body;
        const decoded = verifyRefreshToken(token);
        const user = await prisma.user.findUnique({ where: { id: decoded.userId } });
        if (!user) return res.status(401).json({ error: "Invalid token" });

        res.json({
            tokens: {
                accessToken: generateAccessToken(user.id, user.role),
                refreshToken: generateRefreshToken(user.id)
            }
        });
    } catch (err) {
        res.status(401).json({ error: "Invalid/expired token" });
    }
}

// --- GET ALL USERS (optimized select + pagination) ---
async function getAllUsers(req, res, next) {
    try {
        const { page = 1, limit = 10, search, role, sortBy = "id", order = "asc" } = req.query;
        const skip = (page - 1) * limit;
        const where = {};

        if (search) where.OR = [{ email: { contains: search } }, { name: { contains: search } }];
        if (role) where.role = role.toUpperCase();

        const [users, total] = await Promise.all([
            prisma.user.findMany({
                where,
                skip: parseInt(skip),
                take: parseInt(limit),
                orderBy: { [sortBy]: order },
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
                totalPages: Math.ceil(total / limit),
                hasMore: skip + users.length < total
            }
        });
    } catch (err) { next(err); }
}

module.exports = { register, login, changePassword, refreshToken, getAllUsers };
