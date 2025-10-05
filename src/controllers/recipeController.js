const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

// Отримати всі рецепти з продуктами та інгредієнтами
const getAllRecipes = async (req, res, next) => {
    try {
        const recipes = await prisma.recipe.findMany({
            include: {
                product: true,
                ingredient: true
            }
        });

        // Групуємо рецепти по продукту для зручності
        const grouped = recipes.reduce((acc, r) => {
            if (!acc[r.productId]) {
                acc[r.productId] = {
                    product: r.product,
                    ingredients: []
                };
            }
            acc[r.productId].ingredients.push({
                id: r.ingredient.id,
                name: r.ingredient.name,
                unit: r.ingredient.unit,
                quantity: r.quantity
            });
            return acc;
        }, {});

        res.json(Object.values(grouped));
    } catch (err) { next(err); }
};

// Отримати конкретний рецепт по продукту
const getRecipeById = async (req, res, next) => {
    try {
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

        res.json(grouped);
    } catch (err) { next(err); }
};

// Створити рецепт
const createRecipe = async (req, res, next) => {
    try {
        const { productId, ingredientId, quantity } = req.body;
        const recipe = await prisma.recipe.create({
            data: { productId, ingredientId, quantity },
            include: { product: true, ingredient: true }
        });
        res.status(201).json(recipe);
    } catch (err) { next(err); }
};

// Оновити рецепт
const updateRecipe = async (req, res, next) => {
    try {
        const { productId, ingredientId, quantity } = req.body;
        const recipe = await prisma.recipe.update({
            where: { id: Number(req.params.id) },
            data: { productId, ingredientId, quantity },
            include: { product: true, ingredient: true }
        });
        res.json(recipe);
    } catch (err) { next(err); }
};

// Видалити рецепт
const deleteRecipe = async (req, res, next) => {
    try {
        await prisma.recipe.delete({ where: { id: Number(req.params.id) } });
        res.json({ message: "Recipe deleted" });
    } catch (err) { next(err); }
};

module.exports = { getAllRecipes, getRecipeById, createRecipe, updateRecipe, deleteRecipe };
