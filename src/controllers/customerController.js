const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

// ОНОВЛЕНА ФУНКЦІЯ З ПОШУКОМ, ФІЛЬТРАЦІЄЮ ТА ПАГІНАЦІЄЮ
const getAllCustomers = async (req, res, next) => {
    try {
        // 1. Отримуємо параметри з запиту, встановлюємо значення за замовчуванням
        const {
            page = 1,
            limit = 10,
            search,
            sortBy = 'createdAt', // Припускаємо, що у вас є поле createdAt
            order = 'desc'
        } = req.query;

        // 2. Розраховуємо зміщення для пагінації
        const skip = (parseInt(page) - 1) * parseInt(limit);

        // 3. Створюємо об'єкт для фільтрації (where)
        const where = {};
        if (search) {
            where.OR = [
                { firstName: { contains: search, mode: 'insensitive' } },
                { lastName: { contains: search, mode: 'insensitive' } },
                { email: { contains: search, mode: 'insensitive' } }
            ];
        }

        // 4. Створюємо об'єкт для сортування (orderBy)
        const orderBy = {};
        orderBy[sortBy] = order;

        // 5. Виконуємо два запити паралельно: для отримання даних і для загальної кількості
        const [customers, total] = await Promise.all([
            prisma.customer.findMany({
                where,
                skip,
                take: parseInt(limit),
                orderBy
            }),
            prisma.customer.count({ where })
        ]);

        // 6. Формуємо відповідь з даними та інформацією про пагінацію
        res.json({
            data: customers,
            pagination: {
                page: parseInt(page),
                limit: parseInt(limit),
                total,
                totalPages: Math.ceil(total / parseInt(limit)),
                hasMore: skip + customers.length < total
            }
        });
    } catch (err) {
        next(err);
    }
};


const getCustomerById = async (req, res, next) => {
    try {
        const customer = await prisma.customer.findUnique({ where: { id: Number(req.params.id) } });
        if (!customer) return res.status(404).json({ error: "Customer not found" });
        res.json(customer);
    } catch (err) { next(err); }
};

const createCustomer = async (req, res, next) => {
    try {
        const { firstName, lastName, email } = req.body;
        const customer = await prisma.customer.create({ data: { firstName, lastName, email } });
        res.status(201).json(customer);
    } catch (err) { next(err); }
};

const updateCustomer = async (req, res, next) => {
    try {
        const { firstName, lastName, email } = req.body;
        const customer = await prisma.customer.update({
            where: { id: Number(req.params.id) },
            data: { firstName, lastName, email },
        });
        res.json(customer);
    } catch (err) { next(err); }
};

const deleteCustomer = async (req, res, next) => {
    try {
        await prisma.customer.delete({ where: { id: Number(req.params.id) } });
        res.json({ message: "Customer deleted" });
    } catch (err) { next(err); }
};

module.exports = { getAllCustomers, getCustomerById, createCustomer, updateCustomer, deleteCustomer };