const { PrismaClient } = require("@prisma/client");
const { getIO } = require('../socket'); // 👈 ВИПРАВЛЕНО: Імпорт з socket

const prisma = new PrismaClient();

// --- GET ALL ORDERS (optimized) ---
const getAllOrders = async (req, res, next) => {
    try {
        const {
            page = 1,
            limit = 10,
            search,
            customerId,
            minPrice,
            maxPrice,
            startDate,
            endDate,
            sortBy = "date", // 👈 ВИПРАВЛЕНО: 'date'
            order = "desc",
        } = req.query;

        const skip = (parseInt(page) - 1) * parseInt(limit);
        const where = {};

        if (search) {
            where.OR = [
                { customer: { firstName: { contains: search, mode: "insensitive" } } },
                { customer: { lastName: { contains: search, mode: "insensitive" } } },
            ];
        }

        if (customerId) where.customerId = parseInt(customerId);
        if (minPrice || maxPrice) {
            where.totalPrice = {};
            if (minPrice) where.totalPrice.gte = parseFloat(minPrice);
            if (maxPrice) where.totalPrice.lte = parseFloat(maxPrice);
        }
        // 👈 ВИПРАВЛЕНО: 'date'
        if (startDate || endDate) {
            where.date = {};
            if (startDate) where.date.gte = new Date(startDate);
            if (endDate)
                where.date.lte = new Date(
                    new Date(endDate).setDate(new Date(endDate).getDate() + 1)
                );
        }

        const validSortFields = ["id", "customerId", "totalPrice", "date"]; // 👈 ВИПРАВЛЕНО: 'date'
        const safeSortBy = validSortFields.includes(sortBy) ? sortBy : "date"; // 👈 ВИПРАВЛЕНО: 'date'
        const orderBy = { [safeSortBy]: order };

        const [orders, total] = await Promise.all([
            prisma.order.findMany({
                where,
                skip,
                take: parseInt(limit),
                orderBy,
                select: {
                    id: true,
                    totalPrice: true,
                    date: true, // 👈 ВИПРАВЛЕНО: 'date'
                    customer: { select: { id: true, firstName: true, lastName: true } },
                },
            }),
            prisma.order.count({ where }),
        ]);

        res.json({
            data: orders,
            pagination: {
                page: parseInt(page),
                limit: parseInt(limit),
                total,
                totalPages: Math.ceil(total / parseInt(limit)),
                hasMore: skip + orders.length < total,
            },
        });
    } catch (err) {
        next(err);
    }
};

// --- GET ORDER BY ID (full details) ---
const getOrderById = async (req, res, next) => {
    try {
        const orderId = Number(req.params.id);
        const order = await prisma.order.findUnique({
            where: { id: orderId },
            include: {
                customer: true,
                details: {
                    include: {
                        product: { include: { recipes: { include: { ingredient: true } } } },
                    },
                },
            },
        });
        if (!order) return res.status(404).json({ error: "Order not found" });
        res.json(order);
    } catch (err) {
        next(err);
    }
};

// --- CREATE ORDER ---
const createOrder = async (req, res, next) => {
    try {
        const io = getIO(); // 👈 ВИПРАВЛЕНО: Виклик всередині
        const { customerId, totalPrice, details } = req.body;
        const order = await prisma.order.create({
            data: {
                customerId,
                totalPrice,
                // 'date' заповнюється автоматично (@default(now()))
                details: {
                    create: details.map((item) => ({
                        productId: item.productId,
                        quantity: item.quantity,
                    })),
                },
            },
            include: {
                customer: true,
                details: {
                    include: {
                        product: { include: { recipes: { include: { ingredient: true } } } },
                    },
                },
            },
        });

        io.emit("order:created", order); // Глобальна подія
        io.to('ADMIN').to('MODERATOR').emit("notification:new", {
            type: "success",
            message: `New order #${order.id} created for ${order.customer?.firstName || "customer"}.`,
            orderId: order.id,
        });

        res.status(201).json(order);
    } catch (err) {
        if (err.code === "P2003")
            return res.status(400).json({ error: "Invalid customerId or productId" });
        next(err);
    }
};

// --- UPDATE ORDER ---
const updateOrder = async (req, res, next) => {
    try {
        const io = getIO(); // 👈 ВИПРАВЛЕНО: Виклик всередині
        const { totalPrice, status } = req.body; // 'status' у вас немає в схемі, але я залишив
        const orderId = Number(req.params.id);

        const existingOrder = await prisma.order.findUnique({
            where: { id: orderId },
            include: { customer: true },
        });
        if (!existingOrder) return res.status(404).json({ error: "Order not found" });

        const updatedData = {};
        if (totalPrice !== undefined) updatedData.totalPrice = totalPrice;
        // if (status !== undefined) updatedData.status = status; // Розкоментуйте, якщо додасте 'status' в schema.prisma

        const order = await prisma.order.update({
            where: { id: orderId },
            data: updatedData,
            include: {
                customer: true,
                details: {
                    include: {
                        product: { include: { recipes: { include: { ingredient: true } } } },
                    },
                },
            },
        });

        io.emit("order:updated", order);
        // if (status && status !== existingOrder.status) { // Розкоментуйте, якщо додасте 'status'
        //     io.to('ADMIN').to('MODERATOR').emit("notification:new", {
        //         type: "info",
        //         message: `Status of order #${order.id} updated to '${status}'.`,
        //         orderId: order.id,
        //     });
        // }

        res.json(order);
    } catch (err) {
        next(err);
    }
};

// --- DELETE ORDER ---
const deleteOrder = async (req, res, next) => {
    try {
        const io = getIO(); // 👈 ВИПРАВЛЕНО: Виклик всередині
        const orderId = Number(req.params.id);
        const existingOrder = await prisma.order.findUnique({ where: { id: orderId } });
        if (!existingOrder) return res.status(404).json({ error: "Order not found" });

        // Потрібно спочатку видалити OrderDetail, пов'язані з цим Order
        await prisma.orderDetail.deleteMany({ where: { orderId: orderId } });
        await prisma.order.delete({ where: { id: orderId } });

        io.emit("order:deleted", { id: orderId });
        res.status(200).json({ message: "Order deleted" });
    } catch (err) {
        if (err.code === "P2025")
            return res.status(404).json({ error: "Order not found for deletion" });
        next(err);
    }
};

// 👈 ВИПРАВЛЕНО: Видалено 'setIO' з експорту
module.exports = {
    getAllOrders,
    getOrderById,
    createOrder,
    updateOrder,
    deleteOrder,
};