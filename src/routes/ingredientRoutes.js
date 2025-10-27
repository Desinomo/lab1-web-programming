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

/**
 * @swagger
 * tags:
 *   name: Ingredients
 *   description: Ingredient management
 */

/**
 * @swagger
 * /api/ingredients:
 *   get:
 *     summary: Get all ingredients
 *     tags: [Ingredients]
 *     responses:
 *       200:
 *         description: List of all ingredients
 */
router.get("/", getAllIngredients);

/**
 * @swagger
 * /api/ingredients/{id}:
 *   get:
 *     summary: Get ingredient by ID
 *     tags: [Ingredients]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Ingredient found
 *       404:
 *         description: Ingredient not found
 */
router.get("/:id", getIngredientById);

/**
 * @swagger
 * /api/ingredients:
 *   post:
 *     summary: Create new ingredient
 *     tags: [Ingredients]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name:
 *                 type: string
 *               unit:
 *                 type: string
 *     responses:
 *       201:
 *         description: Ingredient created
 *       400:
 *         description: Validation error
 */
router.post("/", authenticateToken, requireRole("ADMIN", "MODERATOR"), ingredientValidation, validate, createIngredient);

/**
 * @swagger
 * /api/ingredients/{id}:
 *   put:
 *     summary: Update ingredient
 *     tags: [Ingredients]
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
 *         description: Ingredient updated
 *       404:
 *         description: Ingredient not found
 */
router.put("/:id", authenticateToken, requireRole("ADMIN", "MODERATOR"), ingredientValidation, validate, updateIngredient);

/**
 * @swagger
 * /api/ingredients/{id}:
 *   delete:
 *     summary: Delete ingredient
 *     tags: [Ingredients]
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
 *         description: Ingredient deleted
 *       404:
 *         description: Ingredient not found
 */
router.delete("/:id", authenticateToken, requireRole("ADMIN"), deleteIngredient);

module.exports = router;
