const express = require("express");
const { body, validationResult } = require("express-validator");
const { getAllIngredients, getIngredientById, createIngredient, updateIngredient, deleteIngredient } = require("../controllers/ingredientController");
const { authenticateToken, requireRole } = require("../middleware/auth");

const router = express.Router();

// Валідація залишається без змін
const ingredientValidation = [
    body("name").trim().isLength({ min: 2 }).withMessage("Name must be at least 2 characters"),
    body("unit").trim().notEmpty().withMessage("Unit is required"),
];

const validate = (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });
    next();
};

// Публічні маршрути для перегляду
router.get("/", getAllIngredients);
router.get("/:id", getIngredientById);

// ✅ ЗМІНЕНО: Створювати та оновлювати тепер можуть АДМІНИ та МОДЕРАТОРИ
router.post("/",
    authenticateToken,
    requireRole("ADMIN", "MODERATOR"), // <-- Додано роль MODERATOR
    ingredientValidation,
    validate,
    createIngredient
);

router.put("/:id",
    authenticateToken,
    requireRole("ADMIN", "MODERATOR"), // <-- Додано роль MODERATOR
    ingredientValidation,
    validate,
    updateIngredient
);

// ✅ Видалення, як і раніше, доступне ТІЛЬКИ АДМІНАМ
router.delete("/:id",
    authenticateToken,
    requireRole("ADMIN"),
    deleteIngredient
);

module.exports = router;