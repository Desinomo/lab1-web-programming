const express = require("express");
const { body, validationResult } = require("express-validator");
const { register, login, refreshToken, getAllUsers, changePassword, forgotPassword,resetPassword } = require("../controllers/authController");
const { authenticateToken, requireRole } = require("../middleware/auth");

const router = express.Router();

// --- Middleware для валідації ---
const validate = (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
    }
    next();
};

// --- Правила валідації ---
const registerValidation = [
    body("email").isEmail().withMessage("Має бути дійсна email адреса"),
    body("password").isLength({ min: 8 }).withMessage("Пароль має містити щонайменше 8 символів"),
    body("name").notEmpty().withMessage("Ім'я є обов'язковим")
];

const loginValidation = [
    body("email").isEmail().withMessage("Має бути дійсна email адреса"),
    body("password").notEmpty().withMessage("Пароль не може бути порожнім")
];

const refreshValidation = [
    body("refreshToken").notEmpty().withMessage("Refresh токен не може бути порожнім")
];
const changePasswordValidation = [
    body("currentPassword").notEmpty().withMessage("Поточний пароль не може бути порожнім"),
    body("newPassword").isLength({ min: 8 }).withMessage("Новий пароль має містити щонайменше 8 символів")
];
const forgotPasswordValidation = [
    body("email").isEmail().withMessage("Має бути дійсна email адреса")
];
const resetPasswordValidation = [
    body("password").isLength({ min: 8 }).withMessage("Пароль має містити щонайменше 8 символів")
];
// --- Маршрути ---

/**
 * @swagger
 * /api/auth/register:
 *   post:
 *     summary: Реєстрація нового користувача
 *     tags: [Authentication]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - email
 *               - password
 *               - name
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *               password:
 *                 type: string
 *                 minLength: 8
 *               name:
 *                 type: string
 *     responses:
 *       201:
 *         description: Користувач успішно зареєстрований
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 user:
 *                   type: object
 *                   properties:
 *                     id:
 *                       type: integer
 *                     name:
 *                       type: string
 *                     email:
 *                       type: string
 *                 tokens:
 *                   type: object
 *                   properties:
 *                     accessToken:
 *                       type: string
 *                     refreshToken:
 *                       type: string
 *       400:
 *         description: Помилка валідації даних
 *       409:
 *         description: Користувач вже існує
 */
router.post('/register', registerValidation, validate, register);

/**
 * @swagger
 * /api/auth/login:
 *   post:
 *     summary: Вхід користувача
 *     tags: [Authentication]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - email
 *               - password
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *               password:
 *                 type: string
 *     responses:
 *       200:
 *         description: Успішний вхід
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 tokens:
 *                   type: object
 *                   properties:
 *                     accessToken:
 *                       type: string
 *                     refreshToken:
 *                       type: string
 *       401:
 *         description: Невірні дані для входу
 */
router.post('/login', loginValidation, validate, login);

/**
 * @swagger
 * /api/auth/refresh:
 *   post:
 *     summary: Оновлення access токену
 *     tags: [Authentication]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - refreshToken
 *             properties:
 *               refreshToken:
 *                 type: string
 *     responses:
 *       200:
 *         description: Токен успішно оновлено
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 accessToken:
 *                   type: string
 *       401:
 *         description: Недійсний refresh токен
 */
router.post('/refresh', refreshValidation, validate, refreshToken);

/**
 * @swagger
 * /api/auth/users:
 *   get:
 *     summary: Отримати список всіх користувачів (тільки для адмінів)
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *         description: Номер сторінки
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 10
 *         description: Кількість елементів на сторінці
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *         description: Пошук за email або іменем
 *     responses:
 *       200:
 *         description: Список користувачів
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 page:
 *                   type: integer
 *                 limit:
 *                   type: integer
 *                 total:
 *                   type: integer
 *                 users:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       id:
 *                         type: integer
 *                       name:
 *                         type: string
 *                       email:
 *                         type: string
 *       401:
 *         description: Необхідна аутентифікація
 *       403:
 *         description: Недостатньо прав
 */
router.get('/users', authenticateToken, requireRole('ADMIN'), getAllUsers);


/**
 * @swagger
 * /api/auth/change-password:
 *   put:
 *     summary: Change password for the current user
 *     tags: [Authentication]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - currentPassword
 *               - newPassword
 *             properties:
 *               currentPassword:
 *                 type: string
 *                 description: Current password of the user
 *               newPassword:
 *                 type: string
 *                 minLength: 8
 *                 description: New password
 *     responses:
 *       '200':
 *         description: Password successfully updated
 *       '400':
 *         description: Validation error (e.g., new password too short)
 *       '401':
 *         description: Authentication required or current password is incorrect
 */
router.put(
    '/change-password',
    authenticateToken, // Перевіряємо, що користувач залогінений
    changePasswordValidation, // Перевіряємо дані
    validate, // Обробляємо помилки валідації
    changePassword // Викликаємо логіку контролера
);
/**
 * @swagger
 * /api/auth/forgot-password:
 *   post:
 *     summary: Request password reset
 *     tags: [Authentication]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - email
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *     responses:
 *       '200':
 *         description: Password reset email sent (if user exists)
 */
router.post('/forgot-password', forgotPasswordValidation, validate, forgotPassword);

/**
 * @swagger
 * /api/auth/reset-password/{token}:
 *   put:
 *     summary: Set a new password using a token
 *     tags: [Authentication]
 *     parameters:
 *       - in: path
 *         name: token
 *         required: true
 *         schema:
 *           type: string
 *         description: Token from email for password reset
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - password
 *             properties:
 *               password:
 *                 type: string
 *                 minLength: 8
 *     responses:
 *       '200':
 *         description: Password successfully changed
 *       '400':
 *         description: Token is invalid or expired
 */
router.put('/reset-password/:token', resetPasswordValidation, validate, resetPassword);

module.exports = router;
