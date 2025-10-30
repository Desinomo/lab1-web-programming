const { PrismaClient } = require("@prisma/client");
const Joi = require("joi");
const { getIO } = require('../socket'); // 👈 ВИПРАВЛЕНО: Імпорт з socket

const prisma = new PrismaClient();

// --- Validation schema ---
const productSchema = Joi.object({
    name: Joi.string().min(1).required(),
    description: Joi.string().allow(null, ''),
    price: Joi.number().positive().required()
});

// --- GET all products ---
const getAllProducts = async (req, res, next) => {
    try {
        const { page = 1, limit = 10, search, minPrice, maxPrice, sortBy = 'createdAt', order = 'desc' } = req.query;
        const skip = (parseInt(page) - 1) * parseInt(limit);

        const where = {};
        if (search) {
            where.OR = [
                { name: { contains: search, mode: 'insensitive' } },
                { description: { contains: search, mode: 'insensitive' } }
            ];
        }
        if (minPrice || maxPrice) {
            where.price = {};
            if (minPrice) where.price.gte = parseFloat(minPrice);
            if (maxPrice) where.price.lte = parseFloat(maxPrice);
        }

        const validSortFields = ['id', 'name', 'price', 'createdAt'];
        const safeSortBy = validSortFields.includes(sortBy) ? sortBy : 'id';
        const orderBy = { [safeSortBy]: order };

        const [products, total] = await Promise.all([
            prisma.product.findMany({
                where,
                skip,
                take: parseInt(limit),
                orderBy,
                select: {
                    id: true,
                    name: true,
                    description: true,
                    price: true,
                    createdAt: true,
                    recipes: {
                        select: {
                            id: true,
                            quantity: true,
                            ingredient: { select: { id: true, name: true } }
                        }
                    }
                }
            }),
            prisma.product.count({ where })
        ]);

        res.json({
            data: products,
            pagination: {
                page: parseInt(page),
                limit: parseInt(limit),
                total,
                totalPages: Math.ceil(total / parseInt(limit)),
                hasMore: skip + products.length < total
            }
        });
    } catch (err) { next(err); }
};

// --- GET product by ID ---
const getProductById = async (req, res, next) => {
    try {
        const productId = Number(req.params.id);
        const product = await prisma.product.findUnique({
            where: { id: productId },
            select: {
                id: true,
                name: true,
                description: true,
                price: true,
                createdAt: true,
                recipes: {
                    select: {
                        id: true,
                        quantity: true,
                        ingredient: { select: { id: true, name: true } }
                    }
                }
            }
        });

        if (!product) return res.status(404).json({ error: "Product not found" });
        res.json(product);
    } catch (err) { next(err); }
};

// --- CREATE product ---
const createProduct = async (req, res, next) => {
    try {
        const io = getIO(); // 👈 ВИПРАВЛЕНО: Виклик всередині
        const { error, value } = productSchema.validate(req.body);
        if (error) return res.status(400).json({ error: error.details[0].message });

        const product = await prisma.product.create({
            data: value,
            select: {
                id: true,
                name: true,
                description: true,
                price: true,
                createdAt: true,
                recipes: { select: { id: true } }
            }
        });

        io.emit('product:created', product); // Глобальна подія
        // РІВЕНЬ 1 (КІМНАТИ): Сповіщення тільки для адмінів/модераторів
        io.to('ADMIN').to('MODERATOR').emit('notification:new', { type: 'success', message: `New product added: ${product.name}`, productId: product.id });

        res.status(201).json(product);
    } catch (err) {
        if (err.code === 'P2002' && err.meta?.target?.includes('name')) {
            return res.status(409).json({ error: "Product with this name already exists" });
        }
        next(err);
    }
};

// --- UPDATE product ---
const updateProduct = async (req, res, next) => {
    try {
        const io = getIO(); // 👈 ВИПРАВЛЕНО: Виклик всередині
        const productId = Number(req.params.id);
        const { error, value } = productSchema.validate(req.body);
        if (error) return res.status(400).json({ error: error.details[0].message });

        const existingProduct = await prisma.product.findUnique({ where: { id: productId } });
        if (!existingProduct) return res.status(404).json({ error: "Product not found for update" });

        const product = await prisma.product.update({
            where: { id: productId },
            data: value,
            select: {
                id: true,
                name: true,
                description: true,
                price: true,
                createdAt: true,
                recipes: { select: { id: true } }
            }
        });

        io.emit('product:updated', product); // Глобальна подія
        io.to('ADMIN').to('MODERATOR').emit('notification:new', { type: 'info', message: `Product updated: ${product.name}`, productId: product.id });

        res.json(product);
    } catch (err) {
        if (err.code === 'P2002' && err.meta?.target?.includes('name')) {
            return res.status(409).json({ error: "Another product with this name already exists" });
        }
        next(err);
    }
};

// --- DELETE product ---
const deleteProduct = async (req, res, next) => {
    try {
        const io = getIO(); // 👈 ВИПРАВЛЕНО: Виклик всередині
        const productId = Number(req.params.id);
        const existingProduct = await prisma.product.findUnique({ where: { id: productId } });
        if (!existingProduct) return res.status(404).json({ error: "Product not found for deletion" });

        await prisma.product.delete({ where: { id: productId } });

        io.emit('product:deleted', { id: productId }); // Глобальна подія
        io.to('ADMIN').to('MODERATOR').emit('notification:new', { type: 'warning', message: `Product deleted: ${existingProduct.name}`, productId });

        res.status(200).json({ message: "Product deleted" });
    } catch (err) {
        if (err.code === 'P2025') return res.status(404).json({ error: "Product not found for deletion" });
        if (err.code === 'P2003') return res.status(400).json({ error: "Cannot delete product because it is currently in use" });
        next(err);
    }
};

// 👈 ВИПРАВЛЕНО: Видалено 'setIO' та 'getIO' з експорту
module.exports = {
    getAllProducts,
    getProductById,
    createProduct,
    updateProduct,
    deleteProduct
};