const express = require("express");
const { body, validationResult } = require("express-validator");
const { getAllCustomers, getCustomerById, createCustomer, updateCustomer, deleteCustomer } = require("../controllers/customerController");
// Використовуємо ваші поточні назви middleware для послідовності
const { authenticateToken, requireRole } = require("../middleware/auth");

const router = express.Router();

// Валідація залишається без змін, це найкраща практика
const customerValidation = [
    body("firstName").trim().isLength({ min: 2 }).withMessage("First name must be at least 2 characters"),
    body("lastName").trim().isLength({ min: 2 }).withMessage("Last name must be at least 2 characters"),
    body("email").isEmail().withMessage("Must be a valid email"),
];

const validate = (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });
    next();
};

// Публічні маршрути для перегляду
router.get("/", getAllCustomers);
router.get("/:id", getCustomerById);

// ✅ ЗМІНЕНО: Створювати та оновлювати тепер можуть АДМІНИ та МОДЕРАТОРИ
router.post("/",
    authenticateToken,
    requireRole("ADMIN", "MODERATOR"), // <-- Додано роль MODERATOR
    customerValidation,
    validate,
    createCustomer
);

router.put("/:id",
    authenticateToken,
    requireRole("ADMIN", "MODERATOR"), // <-- Додано роль MODERATOR
    customerValidation,
    validate,
    updateCustomer
);

// ✅ Видалення, як і раніше, доступне ТІЛЬКИ АДМІНАМ
router.delete("/:id",
    authenticateToken,
    requireRole("ADMIN"),
    deleteCustomer
);

module.exports = router;