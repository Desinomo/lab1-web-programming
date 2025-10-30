// controllers/customerController.js
const { PrismaClient } = require('@prisma/client');
const { getIO } = require('../socket');
const Joi = require('joi');

const prisma = new PrismaClient();
const customerSchema = Joi.object({
    firstName: Joi.string().min(1).required(),
    lastName: Joi.string().min(1).required(),
    email: Joi.string().email().required()
});

const getAllCustomers = async (req, res, next) => {
    try {
        // 👈 ВИПРАВЛЕНО: 'io' тут не потрібен
        const { page = 1, limit = 10, search, sortBy = 'createdAt', order = 'desc' } = req.query;
        const skip = (parseInt(page) - 1) * parseInt(limit);

        const where = {};
        if (search) where.OR = [
            { firstName: { contains: search, mode: 'insensitive' } },
            { lastName: { contains: search, mode: 'insensitive' } },
            { email: { contains: search, mode: 'insensitive' } }
        ];

        const validSortFields = ['id', 'firstName', 'lastName', 'email', 'createdAt'];
        const safeSortBy = validSortFields.includes(sortBy) ? sortBy : 'createdAt';
        const orderBy = { [safeSortBy]: order };

        const [customers, total] = await Promise.all([
            prisma.customer.findMany({ where, skip, take: parseInt(limit), orderBy }),
            prisma.customer.count({ where })
        ]);

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
    } catch (err) { next(err); }
};

const getCustomerById = async (req, res, next) => {
    try {
        const customerId = Number(req.params.id);
        const customer = await prisma.customer.findUnique({ where: { id: customerId } });
        if (!customer) return res.status(404).json({ error: "Customer not found" });
        res.json(customer);
    } catch (err) { next(err); }
};

const createCustomer = async (req, res, next) => {
    try {
        const io = getIO(); // 👈 ВИПРАВЛЕНО: Виклик всередині
        const { error } = customerSchema.validate(req.body);
        if (error) return res.status(400).json({ error: error.details[0].message });

        const { firstName, lastName, email } = req.body;
        const customer = await prisma.customer.create({ data: { firstName, lastName, email } });

        io.emit('customer:created', customer); // Глобальна подія для всіх
        // Сповіщення тільки для адмінів/модераторів
        io.to('ADMIN').to('MODERATOR').emit('notification:new', { type: 'info', message: `New customer created: ${customer.firstName} ${customer.lastName}`, customerId: customer.id });

        res.status(201).json(customer);
    } catch (err) {
        if (err.code === 'P2002' && err.meta?.target?.includes('email')) return res.status(409).json({ error: "Customer with this email already exists" });
        next(err);
    }
};

const updateCustomer = async (req, res, next) => {
    try {
        const io = getIO(); // 👈 ВИПРАВЛЕНО: Виклик всередині
        const { error } = customerSchema.validate(req.body);
        if (error) return res.status(400).json({ error: error.details[0].message });

        const customerId = Number(req.params.id);
        const existingCustomer = await prisma.customer.findUnique({ where: { id: customerId } });
        if (!existingCustomer) return res.status(404).json({ error: "Customer not found" });

        const { firstName, lastName, email } = req.body;
        const customer = await prisma.customer.update({ where: { id: customerId }, data: { firstName, lastName, email } });

        io.emit('customer:updated', customer); // Глобальна подія для всіх
        io.to('ADMIN').to('MODERATOR').emit('notification:new', { type: 'success', message: `Customer ${customer.firstName} ${customer.lastName} updated`, customerId: customer.id });

        res.json(customer);
    } catch (err) {
        if (err.code === 'P2002' && err.meta?.target?.includes('email')) return res.status(409).json({ error: "Another customer with this email exists" });
        next(err);
    }
};

const deleteCustomer = async (req, res, next) => {
    try {
        const io = getIO(); // 👈 ВИПРАВЛЕНО: Виклик всередині
        const customerId = Number(req.params.id);
        const existingCustomer = await prisma.customer.findUnique({ where: { id: customerId } });
        if (!existingCustomer) return res.status(404).json({ error: "Customer not found" });

        const orders = await prisma.order.findFirst({ where: { customerId } });
        if (orders) return res.status(400).json({ error: "Cannot delete customer with existing orders" });

        await prisma.customer.delete({ where: { id: customerId } });

        io.emit('customer:deleted', { id: customerId }); // Глобальна подія для всіх
        res.status(200).json({ message: "Customer deleted" });
    } catch (err) { next(err); }
};

module.exports = { getAllCustomers, getCustomerById, createCustomer, updateCustomer, deleteCustomer };