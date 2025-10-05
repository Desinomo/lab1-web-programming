const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

const getAllCustomers = async (req, res, next) => {
  try {
    const customers = await prisma.customer.findMany();
    res.json(customers);
  } catch (err) { next(err); }
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
