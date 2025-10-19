const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

// �������� ����ֲ�
const getAllRecipes = async (req, res, next) => {
    try {
        // 1. �������� ��������� ������
        const {
            page = 1,
            limit = 10,
            search,         // ��� ������ �� ������ �������� ��� �����䳺���
            productId,
            ingredientId,
            sortBy = 'id',  // ���������� ����� ������ �������
            order = 'desc'
        } = req.query;

        // 2. ����������� �������
        const skip = (parseInt(page) - 1) * parseInt(limit);

        // 3. ��������� ��'��� ��� ���������� (where)
        const where = {};

        // ������������ �����
        if (search) {
            where.OR = [
                { product: { name: { contains: search, mode: 'insensitive' } } },
                { ingredient: { name: { contains: search, mode: 'insensitive' } } }
            ];
        }

        // ����� ���������� �� ID �������� ��� �����䳺���
        if (productId) {
            where.productId = parseInt(productId);
        }
        if (ingredientId) {
            where.ingredientId = parseInt(ingredientId);
        }

        // 4. ��������� ��'��� ��� ����������
        const orderBy = {};
        orderBy[sortBy] = order;

        // 5. ������ ������ �� �� ����������
        const [recipes, total] = await Promise.all([
            prisma.recipe.findMany({
                where,
                skip,
                take: parseInt(limit),
                orderBy,
                // �������� ��� `include` ��� ��������� ��'����
                include: {
                    product: true,
                    ingredient: true
                }
            }),
            // ������ �������� ������� ������, �� ���������� ��������
            prisma.recipe.count({ where })
        ]);

        // 6. ��������Ӫ�� ���� ���������� �� ��������� ����������
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

        // 7. ������� �������� �������
        res.json({
            data: Object.values(grouped), // ���������� ����������� ��'��� � �����
            pagination: {
                page: parseInt(page),
                limit: parseInt(limit),
                total, // �������� ������� ������� ������ �������
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
        res.status(201).json(recipe);
    } catch (err) { next(err); }
};

// ������� ������
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

// �������� ������
const deleteRecipe = async (req, res, next) => {
    try {
        await prisma.recipe.delete({ where: { id: Number(req.params.id) } });
        res.json({ message: "Recipe deleted" });
    } catch (err) { next(err); }
};

module.exports = { getAllRecipes, getRecipeById, createRecipe, updateRecipe, deleteRecipe };
