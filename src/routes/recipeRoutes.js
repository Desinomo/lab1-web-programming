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

/**
 * @swagger
 * tags:
 *   name: Recipes
 *   description: Recipe management
 */

/**
 * @swagger
 * /api/recipes:
 *   get:
 *     summary: Get all recipes
 *     tags: [Recipes]
 *     responses:
 *       200:
 *         description: List of all recipes
 */
router.get("/", getAllRecipes);

/**
 * @swagger
 * /api/recipes/{id}:
 *   get:
 *     summary: Get recipe by ID
 *     tags: [Recipes]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Recipe found
 *       404:
 *         description: Recipe not found
 */
router.get("/:id", getRecipeById);

/**
 * @swagger
 * /api/recipes:
 *   post:
 *     summary: Create new recipe
 *     tags: [Recipes]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               productId:
 *                 type: integer
 *               ingredientId:
 *                 type: integer
 *               quantity:
 *                 type: number
 *     responses:
 *       201:
 *         description: Recipe created
 *       400:
 *         description: Validation error
 */
router.post("/", authenticateToken, requireRole("ADMIN", "MODERATOR"), recipeValidation, validate, createRecipe);

/**
 * @swagger
 * /api/recipes/{id}:
 *   put:
 *     summary: Update recipe
 *     tags: [Recipes]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *     responses:
 *       200:
 *         description: Recipe updated
 *       404:
 *         description: Recipe not found
 */
router.put("/:id", authenticateToken, requireRole("ADMIN", "MODERATOR"), recipeValidation, validate, updateRecipe);

/**
 * @swagger
 * /api/recipes/{id}:
 *   delete:
 *     summary: Delete recipe
 *     tags: [Recipes]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Recipe deleted
 *       404:
 *         description: Recipe not found
 */
router.delete("/:id", authenticateToken, requireRole("ADMIN"), deleteRecipe);

module.exports = router;
