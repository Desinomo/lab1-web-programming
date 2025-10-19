const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

// �������� ����ֲ�
const getAllOrders = async (req, res, next) => {
    try {
        // 1. �������� ��������� ��� ����������, �������� �� ����������
        const {
            page = 1,
            limit = 10,
            search,         // ��� ������ �� ������ �볺��� ��� ������ ��������
            customerId,
            minPrice,
            maxPrice,
            startDate,
            endDate,
            sortBy = 'createdAt',
            order = 'desc'
        } = req.query;

        // 2. ����������� ������� ��� ��������
        const skip = (parseInt(page) - 1) * parseInt(limit);

        // 3. ��������� �������� ��'��� ��� ���������� (where)
        const where = {};

        // ����� �� ������ �볺��� ��� ������ �������� � ���������
        if (search) {
            where.OR = [
                { customer: { firstName: { contains: search, mode: 'insensitive' } } },
                { customer: { lastName: { contains: search, mode: 'insensitive' } } },
                { details: { some: { product: { name: { contains: search, mode: 'insensitive' } } } } }
            ];
        }

        // Գ�������� �� ���������� �볺����
        if (customerId) {
            where.customerId = parseInt(customerId);
        }

        // Գ�������� �� �����
        if (minPrice || maxPrice) {
            where.totalPrice = {};
            if (minPrice) where.totalPrice.gte = parseFloat(minPrice);
            if (maxPrice) where.totalPrice.lte = parseFloat(maxPrice);
        }

        // Գ�������� �� ����� ���������
        if (startDate || endDate) {
            where.createdAt = {};
            if (startDate) where.createdAt.gte = new Date(startDate);
            if (endDate) where.createdAt.lte = new Date(endDate);
        }

        // 4. ��������� ��'��� ��� ����������
        const orderBy = {};
        orderBy[sortBy] = order;

        // 5. �������� ������ �� �� ����������
        const [orders, total] = await Promise.all([
            prisma.order.findMany({
                where,
                skip,
                take: parseInt(limit),
                orderBy,
                // �������� ��� �������� `include` ��� ��������� ��� �������
                include: {
                    customer: true, // ������ �볺��� ��� ������� �������
                    details: {
                        include: {
                            product: {
                                include: {
                                    recipes: { include: { ingredient: true } }
                                }
                            }
                        }
                    }
                }
            }),
            prisma.order.count({ where })
        ]);

        // 6. ������� �������
        res.json({
            data: orders,
            pagination: {
                page: parseInt(page),
                limit: parseInt(limit),
                total,
                totalPages: Math.ceil(total / parseInt(limit)),
                hasMore: skip + orders.length < total
            }
        });
    } catch (err) {
        next(err);
    }
};

// �������� ��������� ���������� �� id
const getOrderById = async (req, res, next) => {
    try {
        const order = await prisma.order.findUnique({
            where: { id: Number(req.params.id) },
            include: {
                details: {
                    include: {
                        product: {
                            include: {
                                recipes: { include: { ingredient: true } }
                            }
                        }
                    }
                }
            }
        });
        if (!order) return res.status(404).json({ error: "Order not found" });
        res.json(order);
    } catch (err) { next(err); }
};

// �������� ���� ���������� � ��������
const createOrder = async (req, res, next) => {
    try {
        const { customerId, totalPrice, details } = req.body;

        const order = await prisma.order.create({
            data: {
                customerId,
                totalPrice,
                details: {
                    create: details.map(item => ({
                        productId: item.productId,
                        quantity: item.quantity
                    }))
                }
            },
            include: {
                details: {
                    include: {
                        product: { include: { recipes: { include: { ingredient: true } } } }
                    }
                }
            }
        });

        res.status(201).json(order);
    } catch (err) {
        next(err);
    }
};


// ������� ����������
const updateOrder = async (req, res, next) => {
    try {
        const { totalPrice } = req.body;
        const order = await prisma.order.update({
            where: { id: Number(req.params.id) },
            data: { totalPrice },
            include: {
                details: {
                    include: {
                        product: { include: { recipes: { include: { ingredient: true } } } }
                    }
                }
            }
        });
        res.json(order);
    } catch (err) { next(err); }
};

// �������� ����������
const deleteOrder = async (req, res, next) => {
    try {
        await prisma.order.delete({ where: { id: Number(req.params.id) } });
        res.json({ message: "Order deleted" });
    } catch (err) { next(err); }
};

module.exports = { getAllOrders, getOrderById, createOrder, updateOrder, deleteOrder };
