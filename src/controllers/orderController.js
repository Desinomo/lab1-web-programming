const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

// ОНОВЛЕНА ФУНКЦІЯ
const getAllOrders = async (req, res, next) => {
    try {
        // 1. Отримуємо параметри для фільтрації, пагінації та сортування
        const {
            page = 1,
            limit = 10,
            search,         // Для пошуку за іменем клієнта або назвою продукту
            customerId,
            minPrice,
            maxPrice,
            startDate,
            endDate,
            sortBy = 'createdAt',
            order = 'desc'
        } = req.query;

        // 2. Розраховуємо зміщення для пагінації
        const skip = (parseInt(page) - 1) * parseInt(limit);

        // 3. Створюємо складний об'єкт для фільтрації (where)
        const where = {};

        // Пошук за іменем клієнта АБО назвою продукту в замовленні
        if (search) {
            where.OR = [
                { customer: { firstName: { contains: search, mode: 'insensitive' } } },
                { customer: { lastName: { contains: search, mode: 'insensitive' } } },
                { details: { some: { product: { name: { contains: search, mode: 'insensitive' } } } } }
            ];
        }

        // Фільтрація за конкретним клієнтом
        if (customerId) {
            where.customerId = parseInt(customerId);
        }

        // Фільтрація за ціною
        if (minPrice || maxPrice) {
            where.totalPrice = {};
            if (minPrice) where.totalPrice.gte = parseFloat(minPrice);
            if (maxPrice) where.totalPrice.lte = parseFloat(maxPrice);
        }

        // Фільтрація за датою створення
        if (startDate || endDate) {
            where.createdAt = {};
            if (startDate) where.createdAt.gte = new Date(startDate);
            if (endDate) where.createdAt.lte = new Date(endDate);
        }

        // 4. Створюємо об'єкт для сортування
        const orderBy = {};
        orderBy[sortBy] = order;

        // 5. Виконуємо запити до БД паралельно
        const [orders, total] = await Promise.all([
            prisma.order.findMany({
                where,
                skip,
                take: parseInt(limit),
                orderBy,
                // Зберігаємо ваш глибокий `include` для отримання всіх деталей
                include: {
                    customer: true, // Додамо клієнта для повноти картини
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

        // 6. Формуємо відповідь
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

// Отримати конкретне замовлення по id
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

// Створити нове замовлення з деталями
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


// Оновити замовлення
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

// Видалити замовлення
const deleteOrder = async (req, res, next) => {
    try {
        await prisma.order.delete({ where: { id: Number(req.params.id) } });
        res.json({ message: "Order deleted" });
    } catch (err) { next(err); }
};

module.exports = { getAllOrders, getOrderById, createOrder, updateOrder, deleteOrder };
