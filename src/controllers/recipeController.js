const { PrismaClient } = require("@prisma/client");
const { getIO } = require('../socket'); // ������ getIO

const prisma = new PrismaClient();

// �������� ��������� io
let io;
try {
    io = getIO();
} catch (error) {
    console.error("Failed to get Socket.IO instance in recipeController.", error);
    io = { emit: () => console.warn("Socket.IO not ready in recipeController.") };
}


// �������� �� ������� (� ���������, ����������� �� �����������)
const getAllRecipes = async (req, res, next) => {
    try {
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
        if (productId) {
            where.productId = parseInt(productId);
        }
        if (ingredientId) {
            where.ingredientId = parseInt(ingredientId);
        }

        const orderBy = {};
        orderBy[sortBy] = order;

        const [recipes, total] = await Promise.all([
            prisma.recipe.findMany({
                where,
                skip,
                take: parseInt(limit),
                orderBy,
                include: {
                    product: true,
                    ingredient: true
                }
            }),
            prisma.recipe.count({ where })
        ]);

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

// �������� ���������� ������ �� ��������
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

// �������� ������
const createRecipe = async (req, res, next) => {
    try {
        const { productId, ingredientId, quantity } = req.body;
        const recipe = await prisma.recipe.create({
            data: { productId, ingredientId, quantity },
            include: { product: true, ingredient: true }
        });

        // ��������� ���� ��� ���������
        io.emit('recipe:created', recipe);

        res.status(201).json(recipe);
    } catch (err) { next(err); }
};

// ������� ������
const updateRecipe = async (req, res, next) => {
    try {
        const { productId, ingredientId, quantity } = req.body;
        const recipeId = Number(req.params.id); // �������� ID � ��������� URL
        const recipe = await prisma.recipe.update({
            where: { id: recipeId }, // ������������� recipeId ���
            data: { productId, ingredientId, quantity }, // productId �� ingredientId ������ ������������
            include: { product: true, ingredient: true }
        });

        // ��������� ���� ��� ���������
        io.emit('recipe:updated', recipe);

        res.json(recipe);
    } catch (err) { next(err); }
};


// �������� ������
const deleteRecipe = async (req, res, next) => {
    try {
        const recipeId = Number(req.params.id); // �������� ID � ��������� URL

        // �������� ����� ����� ����������, ��� �������� productId
        const recipeToDelete = await prisma.recipe.findUnique({
            where: { id: recipeId },
            select: { productId: true } // �������� ����� productId
        });

        // ���� ����� �� ��������, ��������� 404
        if (!recipeToDelete) {
            return res.status(404).json({ error: "Recipe entry not found for deletion" });
        }


        await prisma.recipe.delete({ where: { id: recipeId } });

        // ��������� ���� ��� ��������� � ID ������ �� ID ��������
        io.emit('recipe:deleted', { id: recipeId, productId: recipeToDelete.productId });

        res.status(200).json({ message: "Recipe deleted" }); // ������ ��� ���������� HTTP �������
    } catch (err) {
        if (err.code === 'P2025') { // �������, ���� ����� ��� ��������
            return res.status(404).json({ error: "Recipe entry not found for deletion" });
        }
        next(err);
    }
};


module.exports = { getAllRecipes, getRecipeById, createRecipe, updateRecipe, deleteRecipe };