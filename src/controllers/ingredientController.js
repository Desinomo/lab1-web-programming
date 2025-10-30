// controllers/ingredientController.js
const { PrismaClient } = require('@prisma/client');
const { getIO } = require('../socket');

const prisma = new PrismaClient();
// 👈 ВИПРАВЛЕНО: Видалено 'const io = getIO()' звідси

const getAllIngredients = async (req, res, next) => {
    try {
        // 👈 ВИПРАВЛЕНО: 'io' тут не потрібен
        const { page = 1, limit = 10, search, sortBy = 'name', order = 'asc' } = req.query;
        const skip = (parseInt(page) - 1) * parseInt(limit);

        const where = {};
        if (search) where.name = { contains: search, mode: 'insensitive' };

        const validSortFields = ['id', 'name'];
        const safeSortBy = validSortFields.includes(sortBy) ? sortBy : 'name';
        const orderBy = { [safeSortBy]: order };

        const [ingredients, total] = await Promise.all([
            prisma.ingredient.findMany({
                where,
                skip,
                take: parseInt(limit),
                orderBy,
                include: { recipes: { include: { product: { select: { id: true, name: true, unit: true } } } } }
            }),
            prisma.ingredient.count({ where })
        ]);

        const formatted = ingredients.map(i => ({
            id: i.id,
            name: i.name,
            usedInProducts: i.recipes.map(r => ({
                productId: r.product.id,
                productName: r.product.name,
                quantity: r.quantity,
                unit: r.product.unit || null
            }))
        }));

        res.json({ data: formatted, pagination: { page: parseInt(page), limit: parseInt(limit), total, totalPages: Math.ceil(total / parseInt(limit)), hasMore: skip + ingredients.length < total } });
    } catch (err) { next(err); }
};

const getIngredientById = async (req, res, next) => {
    try {
        const ingredientId = Number(req.params.id);
        const ingredient = await prisma.ingredient.findUnique({
            where: { id: ingredientId },
            include: { recipes: { include: { product: { select: { id: true, name: true, unit: true } } } } }
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

const createIngredient = async (req, res, next) => {
    try {
        const io = getIO(); // 👈 ВИПРАВЛЕНО: Виклик всередині
        const { name } = req.body;
        if (!name || name.trim().length < 2) return res.status(400).json({ error: "Ingredient name must be at least 2 characters" });

        const ingredient = await prisma.ingredient.create({ data: { name: name.trim() } });

        io.emit('ingredient:created', ingredient); // Глобальна подія
        io.to('ADMIN').to('MODERATOR').emit('notification:new', { type: 'success', message: `New ingredient added: ${ingredient.name}`, ingredientId: ingredient.id });

        res.status(201).json(ingredient);
    } catch (err) {
        if (err.code === 'P2002' && err.meta?.target?.includes('name')) return res.status(409).json({ error: "Ingredient with this name already exists" });
        next(err);
    }
};

const updateIngredient = async (req, res, next) => {
    try {
        const io = getIO(); // 👈 ВИПРАВЛЕНО: Виклик всередині
        const ingredientId = Number(req.params.id);
        const { name } = req.body;
        if (!name || name.trim().length < 2) return res.status(400).json({ error: "Ingredient name must be at least 2 characters" });

        const existing = await prisma.ingredient.findUnique({ where: { id: ingredientId } });
        if (!existing) return res.status(404).json({ error: "Ingredient not found for update" });

        const ingredient = await prisma.ingredient.update({ where: { id: ingredientId }, data: { name: name.trim() } });

        io.emit('ingredient:updated', ingredient); // Глобальна подія
        io.to('ADMIN').to('MODERATOR').emit('notification:new', { type: 'info', message: `Ingredient updated: ${ingredient.name}`, ingredientId: ingredient.id });

        res.json(ingredient);
    } catch (err) {
        if (err.code === 'P2002' && err.meta?.target?.includes('name')) return res.status(409).json({ error: "Another ingredient with this name already exists" });
        next(err);
    }
};

const deleteIngredient = async (req, res, next) => {
    try {
        const io = getIO(); // 👈 ВИПРАВЛЕНО: Виклик всередині
        const ingredientId = Number(req.params.id);
        const existing = await prisma.ingredient.findUnique({ where: { id: ingredientId } });
        if (!existing) return res.status(404).json({ error: "Ingredient not found for deletion" });

        const recipesCount = await prisma.recipe.count({ where: { ingredientId } });
        if (recipesCount > 0) return res.status(400).json({ error: `Cannot delete ingredient. Used in ${recipesCount} recipe(s).` });

        await prisma.ingredient.delete({ where: { id: ingredientId } });

        io.emit('ingredient:deleted', { id: ingredientId }); // Глобальна подія
        res.status(200).json({ message: "Ingredient deleted" });
    } catch (err) {
        if (err.code === 'P2025') return res.status(404).json({ error: "Ingredient not found for deletion" });
        next(err);
    }
};

module.exports = { getAllIngredients, getIngredientById, createIngredient, updateIngredient, deleteIngredient };