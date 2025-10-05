const express = require("express");
const { body, validationResult } = require("express-validator");
const { getAllRecipes, getRecipeById, createRecipe, updateRecipe, deleteRecipe } = require("../controllers/recipeController");
const { authenticateToken, requireRole } = require("../middleware/auth");

const router = express.Router();

const recipeValidation = [
  body("productId").isInt({ gt: 0 }).withMessage("productId must be a positive integer"),
  body("ingredientId").isInt({ gt: 0 }).withMessage("ingredientId must be a positive integer"),
  body("quantity").isFloat({ gt: 0 }).withMessage("Quantity must be greater than 0"),
];

const validate = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });
  next();
};

// Публічні маршрути
router.get("/", getAllRecipes);
router.get("/:id", getRecipeById);

// Адмінські маршрути
router.post("/", authenticateToken, requireRole("ADMIN"), recipeValidation, validate, createRecipe);
router.put("/:id", authenticateToken, requireRole("ADMIN"), recipeValidation, validate, updateRecipe);
router.delete("/:id", authenticateToken, requireRole("ADMIN"), deleteRecipe);

module.exports = router;
