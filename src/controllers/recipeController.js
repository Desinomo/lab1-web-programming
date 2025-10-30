// controllers/recipeController.js
const { PrismaClient } = require("@prisma/client");
const { getIO } = require('../socket');

const prisma = new PrismaClient();
// 👈 ВИПРАВЛЕНО: Видалено 'const io = getIO()' звідси

// Отримати всі рецепти
const getAllRecipes = async (req, res, next) => {
    try {
        // 👈 ВИПРАВЛЕНО: 'io' тут не потрібен
        const {
            page = 1,
            limit = 10,
            search,
            productId,
            ingredientId,
            sortBy = 'id',
            order = 'desc'
        } = req.query;

        const skip = (parseInt(page) - 1) * parseInt(limit);
        const where = {};

        if (search) {
            where.OR = [
                { product: { name: { contains: search, mode: 'insensitive' } } },
                { ingredient: { name: { contains: search, mode: 'insensitive' } } }
            ];
        }
        if (productId) where.productId = parseInt(productId);
        if (ingredientId) where.ingredientId = parseInt(ingredientId);

        const orderBy = { [sortBy]: order };

        const [recipes, total] = await Promise.all([
            prisma.recipe.findMany({
                where,
                skip,
                take: parseInt(limit),
                orderBy,
                include: { product: true, ingredient: true }
            }),
            prisma.recipe.count({ where })
        ]);

        const grouped = recipes.reduce((acc, r) => {
            if (!acc[r.productId]) {
                acc[r.productId] = { product: r.product, ingredients: [] };
            }
            acc[r.productId].ingredients.push({
                id: r.ingredient.id,
                name: r.ingredient.name,
                // 'unit' знаходиться в моделі Ingredient, не Recipe
                // unit: r.ingredient.unit, // Розкоментуйте, якщо додали 'unit' в Ingredient
                quantity: r.quantity
            });
            return acc;
        }, {});

        res.json({
            data: Object.values(grouped),
            pagination: {
                page: parseInt(page),
                limit: parseInt(limit),
                total,
                totalPages: Math.ceil(total / parseInt(limit)),
                hasMore: skip + recipes.length < total
            }
        });
    } catch (err) {
        next(err);
    }
};

// Отримати конкретний рецепт по продукту
const getRecipeById = async (req, res, next) => {
    try {
        const recipeId = Number(req.params.id); // 👈 Це ID самого рецепту
        const recipe = await prisma.recipe.findUnique({ // 👈 Змінено на findUnique
            where: { id: recipeId }, // 👈 Змінено на 'id'
            include: { product: true, ingredient: true }
        });

        if (!recipe) { // 👈 Перевіряємо, чи знайдено рецепт
            return res.status(404).json({ error: "Recipe not found" });
        }

        // Не потрібно групувати, бо це вже один рецепт
        res.json(recipe);
    } catch (err) {
        next(err);
    }
};

// Створити рецепт
const createRecipe = async (req, res, next) => {
    try {
        const io = getIO(); // 👈 ВИПРАВЛЕНО: Виклик всередині
        const { productId, ingredientId, quantity } = req.body;
        const recipe = await prisma.recipe.create({
            data: { productId, ingredientId, quantity },
            include: { product: true, ingredient: true }
        });

        io.emit('recipe:created', recipe); // Глобальна подія
        res.status(201).json(recipe);
    } catch (err) { next(err); }
};

// Оновити рецепт
const updateRecipe = async (req, res, next) => {
    try {
        const io = getIO(); // 👈 ВИПРАВЛЕНО: Виклик всередині
        const { productId, ingredientId, quantity } = req.body;
        const recipeId = Number(req.params.id);
        const recipe = await prisma.recipe.update({
            where: { id: recipeId },
            data: { productId, ingredientId, quantity },
            include: { product: true, ingredient: true }
        });

        io.emit('recipe:updated', recipe); // Глобальна подія
        res.json(recipe);
    } catch (err) { next(err); }
};

// Видалити рецепт
const deleteRecipe = async (req, res, next) => {
    try {
        const io = getIO(); // 👈 ВИПРАВЛЕНО: Виклик всередині
        const recipeId = Number(req.params.id);

        const recipeToDelete = await prisma.recipe.findUnique({
            where: { id: recipeId },
            select: { productId: true }
        });

        if (!recipeToDelete) return res.status(404).json({ error: "Recipe entry not found" });

        await prisma.recipe.delete({ where: { id: recipeId } });
        io.emit('recipe:deleted', { id: recipeId, productId: recipeToDelete.productId }); // Глобальна подія

        res.status(200).json({ message: "Recipe deleted" });
    } catch (err) {
        if (err.code === 'P2025') return res.status(404).json({ error: "Recipe entry not found for deletion" });
        next(err);
    }
};

module.exports = { getAllRecipes, getRecipeById, createRecipe, updateRecipe, deleteRecipe };