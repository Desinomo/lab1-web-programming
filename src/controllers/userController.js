const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();
const jwt = require("jsonwebtoken");
const bcrypt = require("bcrypt");

// Реєстрація користувача
const registerUser = async (req, res, next) => {
    try {
        const { email, password } = req.body;  // роль з body ігноруємо
        const hashedPassword = await bcrypt.hash(password, 10);
        const user = await prisma.user.create({
            data: {
                email,
                password: hashedPassword,
                role: "USER"  // завжди USER
            }
        });
        res.status(201).json({ id: user.id, email: user.email, role: user.role });
    } catch (err) {
        next(err);
    }
};


// Логін користувача
const loginUser = async (req, res, next) => {
  try {
    const { email, password } = req.body;
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) return res.status(404).json({ error: "User not found" });

    const match = await bcrypt.compare(password, user.password);
    if (!match) return res.status(401).json({ error: "Invalid password" });

    const token = jwt.sign({ userId: user.id, role: user.role }, process.env.JWT_SECRET, { expiresIn: "1h" });
    res.json({ token });
  } catch (err) { next(err); }
};

// Отримати всіх користувачів (тільки адмін)
const getAllUsers = async (req, res, next) => {
  try {
    const users = await prisma.user.findMany({ select: { id: true, email: true, role: true } });
    res.json(users);
  } catch (err) { next(err); }
};

module.exports = { registerUser, loginUser, getAllUsers };
