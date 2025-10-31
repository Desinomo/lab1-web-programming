// controllers/ingredientController.js
const { PrismaClient } = require('@prisma/client');
const { getIO } = require('../socket');
const cache = require('../utils/cache');
const prisma = new PrismaClient();
const CACHE_KEY = 'ingredients_all';

const getAllIngredients = async (req, res, next) => {
    try {
        const cachedIngredients = cache.get(CACHE_KEY);
        if (cachedIngredients) {
            console.log('Serving ingredients from CACHE');
            return res.json(cachedIngredients);
        }

        const { page = 1, limit = 10, search, sortBy = 'name', order = 'asc' } = req.query;
        const isDefaultQuery = page == 1 && limit == 10 && !search && sortBy == 'name' && order == 'asc';
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

        // --- ❗️ ВИПРАВЛЕННЯ ТУТ ---
        // 1. Створюємо змінну `responseData` ЗАЗДАЛЕГІДЬ
        const responseData = {
            data: formatted,
            pagination: {
                page: parseInt(page),
                limit: parseInt(limit),
                total,
                totalPages: Math.ceil(total / parseInt(limit)),
                hasMore: skip + ingredients.length < total
            }
        };

        if (isDefaultQuery) {
            console.log('Storing default ingredients query in CACHE');
            // 2. Тепер ця змінна існує і її можна кешувати
            cache.set(CACHE_KEY, responseData);
        }

        // 3. Відправляємо готову змінну
        res.json(responseData);
        // -------------------------

    } catch (err) { next(err); }
};

const getIngredientById = async (req, res, next) => {
    try {
        const ingredientId = Number(req.params.id);
        const cacheKey = `ingredient_${ingredientId}`;

        // --- ❗️ ВИПРАВЛЕННЯ ТУТ ---
        // 1. Спочатку перевіряємо кеш
        const cachedIngredient = cache.get(cacheKey);
        if (cachedIngredient) {
            console.log(`Serving ingredient ${ingredientId} from CACHE`);
            return res.json(cachedIngredient);
        }
        // -------------------------

        // 2. Якщо в кеші немає - йдемо в БД
        console.log(`Serving ingredient ${ingredientId} from DATABASE`); // Додано лог
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

        // 3. Зберігаємо в кеш
        cache.set(cacheKey, formatted, 3600);
        res.json(formatted);
    } catch (err) { next(err); }
};

// --- Інші функції без змін ---

const createIngredient = async (req, res, next) => {
    try {
        const io = getIO();
        const { name } = req.body;
        if (!name || name.trim().length < 2) return res.status(400).json({ error: "Ingredient name must be at least 2 characters" });

        const ingredient = await prisma.ingredient.create({ data: { name: name.trim() } });
        cache.del(CACHE_KEY);
        io.emit('ingredient:created', ingredient);
        io.to('ADMIN').to('MODERATOR').emit('notification:new', { type: 'success', message: `New ingredient added: ${ingredient.name}`, ingredientId: ingredient.id });

        res.status(201).json(ingredient);
    } catch (err) {
        if (err.code === 'P2002' && err.meta?.target?.includes('name')) return res.status(409).json({ error: "Ingredient with this name already exists" });
        next(err);
    }
};

const updateIngredient = async (req, res, next) => {
    try {
        const io = getIO();
        const ingredientId = Number(req.params.id);
        const { name } = req.body;
        if (!name || name.trim().length < 2) return res.status(400).json({ error: "Ingredient name must be at least 2 characters" });

        const existing = await prisma.ingredient.findUnique({ where: { id: ingredientId } });
        if (!existing) return res.status(404).json({ error: "Ingredient not found for update" });

        const ingredient = await prisma.ingredient.update({ where: { id: ingredientId }, data: { name: name.trim() } });
        cache.del(CACHE_KEY);
        cache.del(`ingredient_${ingredientId}`);
        io.emit('ingredient:updated', ingredient);
        io.to('ADMIN').to('MODERATOR').emit('notification:new', { type: 'info', message: `Ingredient updated: ${ingredient.name}`, ingredientId: ingredient.id });

        res.json(ingredient);
    } catch (err) {
        if (err.code === 'P2002' && err.meta?.target?.includes('name')) return res.status(409).json({ error: "Another ingredient with this name already exists" });
        next(err);
    }
};

const deleteIngredient = async (req, res, next) => {
    try {
        const io = getIO();
        const ingredientId = Number(req.params.id);
        const existing = await prisma.ingredient.findUnique({ where: { id: ingredientId } });
        if (!existing) return res.status(404).json({ error: "Ingredient not found for deletion" });

        const recipesCount = await prisma.recipe.count({ where: { ingredientId } });
        if (recipesCount > 0) return res.status(400).json({ error: `Cannot delete ingredient. Used in ${recipesCount} recipe(s).` });

        await prisma.ingredient.delete({ where: { id: ingredientId } });
        cache.del(CACHE_KEY);
        cache.del(`ingredient_${ingredientId}`);
        console.log(`CACHE CLEARED (deleteIngredient: ${ingredientId})`);
        io.emit('ingredient:deleted', { id: ingredientId });
        res.status(200).json({ message: "Ingredient deleted" });
    } catch (err) {
        if (err.code === 'P2025') return res.status(4404).json({ error: "Ingredient not found for deletion" });
        next(err);
    }
};

module.exports = { getAllIngredients, getIngredientById, createIngredient