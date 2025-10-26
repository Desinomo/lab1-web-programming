const { PrismaClient } = require("@prisma/client");

const prisma = new PrismaClient();

// --- Socket.IO instance ---
let io = null;

// Set Socket.IO instance from server after initialization
const setIO = (socketInstance) => {
    io = socketInstance;
};

// Safe emit function
const safeEmit = (event, payload) => {
    if (io && typeof io.emit === "function") {
        io.emit(event, payload);
    } else {
        console.warn(`Socket.IO not ready. Event "${event}" not emitted.`);
    }
};

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
            sortBy = "createdAt",
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
        if (startDate || endDate) {
            where.createdAt = {};
            if (startDate) where.createdAt.gte = new Date(startDate);
            if (endDate)
                where.createdAt.lte = new Date(
                    new Date(endDate).setDate(new Date(endDate).getDate() + 1)
                );
        }

        const validSortFields = ["id", "customerId", "totalPrice", "createdAt"];
        const safeSortBy = validSortFields.includes(sortBy) ? sortBy : "createdAt";
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
                    createdAt: true,
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
        const { customerId, totalPrice, details } = req.body;
        const order = await prisma.order.create({
            data: {
                customerId,
                totalPrice,
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

        safeEmit("order:created", order);
        safeEmit("notification:new", {
            type: "success",
            message: `New order #${order.id} created for ${order.customer?.firstName || "customer"
                }.`,
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
        const { totalPrice, status } = req.body;
        const orderId = Number(req.params.id);

        const existingOrder = await prisma.order.findUnique({
            where: { id: orderId },
            include: { customer: true },
        });
        if (!existingOrder) return res.status(404).json({ error: "Order not found" });

        const updatedData = {};
        if (totalPrice !== undefined) updatedData.totalPrice = totalPrice;
        if (status !== undefined) updatedData.status = status;

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

        safeEmit("order:updated", order);
        if (status && status !== existingOrder.status) {
            safeEmit("notification:new", {
                type: "info",
                message: `Status of order #${order.id} updated to '${status}'.`,
                orderId: order.id,
            });
        }

        res.json(order);
    } catch (err) {
        next(err);
    }
};

// --- DELETE ORDER ---
const deleteOrder = async (req, res, next) => {
    try {
        const orderId = Number(req.params.id);
        const existingOrder = await prisma.order.findUnique({ where: { id: orderId } });
        if (!existingOrder) return res.status(404).json({ error: "Order not found" });

        await prisma.order.delete({ where: { id: orderId } });

        safeEmit("order:deleted", { id: orderId });
        res.status(200).json({ message: "Order deleted" });
    } catch (err) {
        if (err.code === "P2025")
            return res.status(404).json({ error: "Order not found for deletion" });
        next(err);
    }
};

module.exports = {
    setIO,
    getAllOrders,
    getOrderById,
    createOrder,
    updateOrder,
    deleteOrder,
};
