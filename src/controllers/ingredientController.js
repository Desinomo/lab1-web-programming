const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

// Отримати всі інгредієнти
const getAllIngredients = async (req, res, next) => {
    try {
        const ingredients = await prisma.ingredient.findMany({
            include: { recipes: { include: { product: true } } } // де використовується інгредієнт
        });

        const formatted = ingredients.map(i => ({
            id: i.id,
            name: i.name,
            usedInProducts: i.recipes.map(r => ({
                productId: r.product.id,
                productName: r.product.name,
                quantity: r.quantity,
                unit: r.product.unit || null // якщо потрібно
            }))
        }));

        res.json(formatted);
    } catch (err) { next(err); }
};

// Отримати інгредієнт за id
const getIngredientById = async (req, res, next) => {
    try {
        const ingredient = await prisma.ingredient.findUnique({
            where: { id: Number(req.params.id) },
            include: { recipes: { include: { product: true } } }
        });

        if (!ingredient) return res.status(404).json({ error: "Ingredient not found" });

        const formatted = {
            id: ingredient.id,
            name: ingredient.name,
            usedInProducts: ingredient.recipes.map(r => ({
                productId: r.product.id,
                productName: r.product.name,
                quantity: r.quantity,
                unit: r.product.unit || null
            }))
        };

        res.json(formatted);
    } catch (err) { next(err); }
};

// Створити інгредієнт
const createIngredient = async (req, res, next) => {
    try {
        const { name } = req.body;
        const ingredient = await prisma.ingredient.create({ data: { name } });
        res.status(201).json(ingredient);
    } catch (err) { next(err); }
};

// Оновити інгредієнт
const updateIngredient = async (req, res, next) => {
    try {
        const { name } = req.body;
        const ingredient = await prisma.ingredient.update({
            where: { id: Number(req.params.id) },
            data: { name }
        });
        res.json(ingredient);
    } catch (err) { next(err); }
};

// Видалити інгредієнт
const deleteIngredient = async (req, res, next) => {
    try {
        await prisma.ingredient.delete({ where: { id: Number(req.params.id) } });
        res.json({ message: "Ingredient deleted" });
    } catch (err) { next(err); }
};

module.exports = { getAllIngredients, getIngredientById, createIngredient, updateIngredient, deleteIngredient };
