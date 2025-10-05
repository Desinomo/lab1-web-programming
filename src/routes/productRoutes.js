const express = require("express");
const { body, validationResult } = require("express-validator");
const { getAllProducts, getProductById, createProduct, updateProduct, deleteProduct } = require("../controllers/productController");
const { authenticateToken, requireRole } = require("../middleware/auth");

const router = express.Router();

const productValidation = [
  body("name").trim().isLength({ min: 2 }).withMessage("Name must be at least 2 characters"),
  body("description").optional().isLength({ max: 500 }).withMessage("Description max 500 chars"),
  body("price").isFloat({ gt: 0 }).withMessage("Price must be a number greater than 0"),
];

const validate = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });
  next();
};

// Публічні маршрути
router.get("/", getAllProducts);
router.get("/:id", getProductById);

// Адмінські маршрути
router.post("/", authenticateToken, requireRole("ADMIN"), productValidation, validate, createProduct);
router.put("/:id", authenticateToken, requireRole("ADMIN"), productValidation, validate, updateProduct);
router.delete("/:id", authenticateToken, requireRole("ADMIN"), deleteProduct);

module.exports = router;
