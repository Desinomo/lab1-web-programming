const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

// Фільтрація та пагінація інгредієнтів
const getAllIngredients = async (req, res, next) => {
    try {
        const {
            page = 1,
            limit = 10,
            search,
            minUsedInProducts,
            maxUsedInProducts,
            sortBy = 'name',
            order = 'asc'
        } = req.query;

        const skip = (parseInt(page) - 1) * parseInt(limit);

        const where = {};
        if (search) {
            where.name = { contains: search, mode: 'insensitive' };
        }

        // Додаткова фільтрація за кількістю продуктів
        if (minUsedInProducts || maxUsedInProducts) {
            where.recipes = { some: {} }; // базова умова
        }

        const orderBy = {};
        orderBy[sortBy] = order;

        const [ingredients, total] = await Promise.all([
            prisma.ingredient.findMany({
                where,
                skip,
                take: parseInt(limit),
                orderBy,
                include: { recipes: { include: { product: true } } }
            }),
            prisma.ingredient.count({ where })
        ]);

        const formattedIngredients = ingredients.map(i => ({
            id: i.id,
            name: i.name,
            usedInProducts: i.recipes.map(r => ({
                productId: r.product.id,
                productName: r.product.name,
                quantity: r.quantity,
                unit: r.product.unit || null
            }))
        }));

        res.json({
            data: formattedIngredients,
            pagination: {
                page: parseInt(page),
                limit: parseInt(limit),
                total,
                totalPages: Math.ceil(total / parseInt(limit)),
                hasMore: skip + ingredients.length < total
            }
        });
    } catch (err) {
        next(err);
    }
};

// Middleware для перевірки ролі
const { authenticateToken, authorizeRoles } = require('../middleware/auth');

const getIngredientById = async (req, res, next) => {
    try {
        const ingredient = await prisma.ingredient.findUnique({
            where: { id: Number(req.params.id) },
            include: { recipes: { include: { product: true } } }
        });

        if (!ingredient) return res.status(404).json({ error: "Ingredient not found" });

        res.json({
            id: ingredient.id,
            name: ingredient.name,
            usedInProducts: ingredient.recipes.map(r => ({
                productId: r.product.id,
                productName: r.product.name,
                quantity: r.quantity,
                unit: r.product.unit || null
            }))
        });
    } catch (err) { next(err); }
};

const createIngredient = async (req, res, next) => {
    try {
        const { name } = req.body;
        if (!name || name.length < 2) return res.status(400).json({ error: "Invalid name" });

        const ingredient = await prisma.ingredient.create({ data: { name } });
        res.status(201).json(ingredient);
    } catch (err) { next(err); }
};

const updateIngredient = async (req, res, next) => {
    try {
        const { name } = req.body;
        if (!name || name.length < 2) return res.status(400).json({ error: "Invalid name" });

        const ingredient = await prisma.ingredient.update({
            where: { id: Number(req.params.id) },
            data: { name }
        });
        res.json(ingredient);
    } catch (err) { next(err); }
};

const deleteIngredient = async (req, res, next) => {
    try {
        await prisma.ingredient.delete({ where: { id: Number(req.params.id) } });
        res.json({ message: "Ingredient deleted" });
    } catch (err) { next(err); }
};

module.exports = {
    getAllIngredients,
    getIngredientById,
    createIngredient,
    updateIngredient,
    deleteIngredient
};
