const { PrismaClient } = require("@prisma/client");
const { getIO } = require('../socket'); // Імпорт getIO

const prisma = new PrismaClient();

// Отримати всі рецепти (з пагінацією, фільтрацією та групуванням)
const getAllRecipes = async (req, res, next) => {
    try {
        const io = getIO(); // <- виклик всередині функції
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
                unit: r.ingredient.unit,
                quantity: r.quantity
            });
            return acc;
        }, {});

        // Можна відправляти подію, якщо потрібно
        // io.emit('recipes:fetched', grouped);

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
        const io = getIO();
        const recipes = await prisma.recipe.findMany({
            where: { productId: Number(req.params.id) },
            include: { product: true, ingredient: true }
        });

        if (!recipes.length) return res.status(404).json({ error: "Recipe not found" });

        const grouped = {
            product: recipes[0].product,
            ingredients: recipes.map(r => ({
                id: r.ingredient.id,
                name: r.ingredient.name,
                unit: r.ingredient.unit,
                quantity: r.quantity
            }))
        };

        // io.emit('recipe:fetched', grouped); // за потреби

        res.json(grouped);
    } catch (err) {
        next(err);
    }
};

// Створити рецепт
const createRecipe = async (req, res, next) => {
    try {
        const io = getIO();
        const { productId, ingredientId, quantity } = req.body;
        const recipe = await prisma.recipe.create({
            data: { productId, ingredientId, quantity },
            include: { product: true, ingredient: true }
        });

        io.emit('recipe:created', recipe);
        res.status(201).json(recipe);
    } catch (err) { next(err); }
};

// Оновити рецепт
const updateRecipe = async (req, res, next) => {
    try {
        const io = getIO();
        const { productId, ingredientId, quantity } = req.body;
        const recipeId = Number(req.params.id);
        const recipe = await prisma.recipe.update({
            where: { id: recipeId },
            data: { productId, ingredientId, quantity },
            include: { product: true, ingredient: true }
        });

        io.emit('recipe:updated', recipe);
        res.json(recipe);
    } catch (err) { next(err); }
};

// Видалити рецепт
const deleteRecipe = async (req, res, next) => {
    try {
        const io = getIO();
        const recipeId = Number(req.params.id);

        const recipeToDelete = await prisma.recipe.findUnique({
            where: { id: recipeId },
            select: { productId: true }
        });

        if (!recipeToDelete) return res.status(404).json({ error: "Recipe entry not found" });

        await prisma.recipe.delete({ where: { id: recipeId } });
        io.emit('recipe:deleted', { id: recipeId, productId: recipeToDelete.productId });

        res.status(200).json({ message: "Recipe deleted" });
    } catch (err) {
        if (err.code === 'P2025') return res.status(404).json({ error: "Recipe entry not found for deletion" });
        next(err);
    }
};

module.exports = { getAllRecipes, getRecipeById, createRecipe, updateRecipe, deleteRecipe };
