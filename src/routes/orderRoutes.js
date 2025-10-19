const express = require("express");
const { body, validationResult } = require("express-validator");
const { getAllOrders, getOrderById, createOrder, updateOrder, deleteOrder } = require("../controllers/orderController");
const { authenticateToken, requireRole } = require("../middleware/auth");

const router = express.Router();

// Додамо базову валідацію для створення замовлення
const orderValidation = [
    body("customerId").isInt({ gt: 0 }).withMessage("Customer ID must be a positive integer"),
    body("totalPrice").isFloat({ gt: 0 }).withMessage("Total price must be a positive number"),
    body("details").isArray({ min: 1 }).withMessage("Order must contain at least one item"),
];

const validate = (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });
    next();
};

// Публічні маршрути для перегляду
router.get("/", getAllOrders);
router.get("/:id", getOrderById);

// ✅ ЗМІНЕНО: Створювати та оновлювати тепер можуть АДМІНИ та МОДЕРАТОРИ
router.post("/",
    authenticateToken,
    requireRole("ADMIN", "MODERATOR"), // <-- Додано роль MODERATOR
    orderValidation,
    validate,
    createOrder
);

router.put("/:id",
    authenticateToken,
    requireRole("ADMIN", "MODERATOR"), // <-- Додано роль MODERATOR
    updateOrder
);

// ✅ Видалення, як і раніше, доступне ТІЛЬКИ АДМІНАМ
router.delete("/:id",
    authenticateToken,
    requireRole("ADMIN"),
    deleteOrder
);

module.exports = router;