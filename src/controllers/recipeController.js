// controllers/recipeController.js
const { PrismaClient } = require("@prisma/client");
const { getIO } = require('../socket');

const prisma = new PrismaClient();
// 👈 Видалено 'const io = getIO()' звідси

// Отримати всі рецепти
const getAllRecipes = async (req, res, next) => {
    try {
        // 'io' тут не потрібен
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

        // Групування - це складна логіка, залишаємо як є
        const grouped = recipes.reduce((acc, r) => {
            if (!acc[r.productId]) {
                acc[r.productId] = { product: r.product, ingredients: [] };
            }
            acc[r.productId].ingredients.push({
                id: r.ingredient.id,
                name: r.ingredient.name,
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

// Отримати конкретний рецепт по ID
const getRecipeById = async (req, res, next) => {
    try {
        // 'io' тут не потрібен
        const recipeId = Number(req.params.id); // 👈 ВИПРАВЛЕНО: Це ID самого рецепту
        const recipe = await prisma.recipe.findUnique({ // 👈 ВИПРАВЛЕНО: на findUnique
            where: { id: recipeId }, // 👈 ВИПРАВЛЕНО: шукаємо за 'id'
            include: { product: true, ingredient: true }
        });

        if (!recipe) { // 👈 Перевіряємо, чи знайдено рецепт
            return res.status(404).json({ error: "Recipe not found" });
        }

        res.json(recipe); // Повертаємо один рецепт
    } catch (err) {
        next(err);
    }
};

// Створити рецепт
const createRecipe = async (req, res, next) => {
    try {
        const io = getIO(); // 👈 Виклик всередині
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
        const io = getIO(); // 👈 Виклик всередині
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
        const io = getIO(); // 👈 Виклик всередині
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