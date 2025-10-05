const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

// Отримати всі продукти з інгредієнтами
const getAllProducts = async (req, res, next) => {
    try {
        const products = await prisma.product.findMany({
            include: {
                recipes: { include: { ingredient: true } } // включає інгредієнти через рецепт
            }
        });
        res.json(products);
    } catch (err) { next(err); }
};

// Отримати конкретний продукт з інгредієнтами
const getProductById = async (req, res, next) => {
    try {
        const product = await prisma.product.findUnique({
            where: { id: Number(req.params.id) },
            include: {
                recipes: { include: { ingredient: true } }
            }
        });

        if (!product) return res.status(404).json({ error: "Product not found" });
        res.json(product);
    } catch (err) { next(err); }
};

// Створити продукт
const createProduct = async (req, res, next) => {
    try {
        const { name, description, price } = req.body;
        const product = await prisma.product.create({ data: { name, description, price } });
        res.status(201).json(product);
    } catch (err) { next(err); }
};

// Оновити продукт
const updateProduct = async (req, res, next) => {
    try {
        const { name, description, price } = req.body;
        const product = await prisma.product.update({
            where: { id: Number(req.params.id) },
            data: { name, description, price },
        });
        res.json(product);
    } catch (err) { next(err); }
};

// Видалити продукт
const deleteProduct = async (req, res, next) => {
    try {
        await prisma.product.delete({ where: { id: Number(req.params.id) } });
        res.json({ message: "Product deleted" });
    } catch (err) { next(err); }
};

module.exports = { getAllProducts, getProductById, createProduct, updateProduct, deleteProduct };
