const express = require("express");
const { body, validationResult } = require("express-validator");
const { getAllIngredients, getIngredientById, createIngredient, updateIngredient, deleteIngredient } = require("../controllers/ingredientController");
const { authenticateToken, requireRole } = require("../middleware/auth");

const router = express.Router();

const ingredientValidation = [
  body("name").trim().isLength({ min: 2 }).withMessage("Name must be at least 2 characters"),
  body("unit").trim().notEmpty().withMessage("Unit is required"),
];

const validate = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });
  next();
};

// Публічні маршрути
router.get("/", getAllIngredients);
router.get("/:id", getIngredientById);

// Адмінські маршрути
router.post("/", authenticateToken, requireRole("ADMIN"), ingredientValidation, validate, createIngredient);
router.put("/:id", authenticateToken, requireRole("ADMIN"), ingredientValidation, validate, updateIngredient);
router.delete("/:id", authenticateToken, requireRole("ADMIN"), deleteIngredient);

module.exports = router;
