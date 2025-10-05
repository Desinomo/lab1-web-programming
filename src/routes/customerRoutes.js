const express = require("express");
const { body, validationResult } = require("express-validator");
const { getAllCustomers, getCustomerById, createCustomer, updateCustomer, deleteCustomer } = require("../controllers/customerController");
const { authenticateToken, requireRole } = require("../middleware/auth");

const router = express.Router();

const customerValidation = [
  body("firstName").trim().isLength({ min: 2 }).withMessage("First name must be at least 2 characters"),
  body("lastName").trim().isLength({ min: 2 }).withMessage("Last name must be at least 2 characters"),
  body("email").isEmail().withMessage("Must be a valid email"),
];

const validate = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });
  next();
};

// Публічні маршрути
router.get("/", getAllCustomers);
router.get("/:id", getCustomerById);

// Адмінські маршрути
router.post("/", authenticateToken, requireRole("ADMIN"), customerValidation, validate, createCustomer);
router.put("/:id", authenticateToken, requireRole("ADMIN"), customerValidation, validate, updateCustomer);
router.delete("/:id", authenticateToken, requireRole("ADMIN"), deleteCustomer);

module.exports = router;
