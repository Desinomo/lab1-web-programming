const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

// �������� ����ֲ�
const getAllProducts = async (req, res, next) => {
    try {
        // 1. �������� ��������� ��� ����������, �������� �� ���������� � req.query
        const {
            page = 1,
            limit = 10,
            search,
            category, // ����������, �� � ��� � ���� category
            minPrice,
            maxPrice,
            sortBy = 'createdAt',
            order = 'desc'
        } = req.query;

        // 2. ����������� ������� ��� ��������
        const skip = (parseInt(page) - 1) * parseInt(limit);

        // 3. ��������� ��'��� ��� ���������� (where)
        const where = {};

        if (search) {
            where.OR = [
                { name: { contains: search, mode: 'insensitive' } },
                { description: { contains: search, mode: 'insensitive' } }
            ];
        }
        if (category) {
            where.category = category; // ���� � ��� � ������ Category, ��� ���� { name: category }
        }
        if (minPrice || maxPrice) {
            where.price = {};
            if (minPrice) where.price.gte = parseFloat(minPrice);
            if (maxPrice) where.price.lte = parseFloat(maxPrice);
        }

        // 4. ��������� ��'��� ��� ���������� (orderBy)
        const orderBy = {};
        orderBy[sortBy] = order;

        // 5. �������� ��� ������ ����������: ���� ��� ��������� �����, ����� ��� �������� �������
        const [products, total] = await Promise.all([
            prisma.product.findMany({
                where,
                skip,
                take: parseInt(limit),
                orderBy,
                // �������: ������ ��� `include` ��� ��������� ������� �� �����䳺���
                include: {
                    recipes: { include: { ingredient: true } }
                }
            }),
            prisma.product.count({ where })
        ]);

        // 6. ������� ������� � ������ �� ����������� ��� ��������
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
    } catch (err) {
        next(err); // �������� ������� � �������������� ��������
    }
};


// �������� ���������� ������� � �����䳺�����
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

// �������� �������
const createProduct = async (req, res, next) => {
    try {
        const { name, description, price } = req.body;
        const product = await prisma.product.create({ data: { name, description, price } });
        res.status(201).json(product);
    } catch (err) { next(err); }
};

// ������� �������
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

// �������� �������
const deleteProduct = async (req, res, next) => {
    try {
        await prisma.product.delete({ where: { id: Number(req.params.id) } });
        res.json({ message: "Product deleted" });
    } catch (err) { next(err); }
};

module.exports = { getAllProducts, getProductById, createProduct, updateProduct, deleteProduct };
