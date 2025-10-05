const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

// Отримати всі замовлення з деталями та продуктами
const getAllOrders = async (req, res, next) => {
    try {
        const orders = await prisma.order.findMany({
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
        res.json(orders);
    } catch (err) { next(err); }
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
