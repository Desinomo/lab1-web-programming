const express = require("express");
const { body, validationResult } = require("express-validator");
const { registerUser, loginUser, getAllUsers } = require("../controllers/userController");
const { authenticateToken, requireRole } = require("../middleware/auth");

const router = express.Router();

// Валідація
const userValidation = [
  body("email").isEmail().withMessage("Must be a valid email"),
  body("password").isLength({ min: 6 }).withMessage("Password must be at least 6 characters"),
];

// Функція перевірки помилок
const validate = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });
  next();
};

// Публічні маршрути
router.post("/register", userValidation, validate, registerUser);
router.post("/login", userValidation, validate, loginUser);


// Адмінський маршрут
router.get("/", authenticateToken, requireRole("ADMIN"), getAllUsers);

module.exports = router;
