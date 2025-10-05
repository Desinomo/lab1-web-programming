const express = require("express");
const { getAllOrders, getOrderById, createOrder, updateOrder, deleteOrder } = require("../controllers/orderController");
const { authenticateToken, requireRole } = require("../middleware/auth");

const router = express.Router();

// Публічні маршрути
router.get("/", getAllOrders);
router.get("/:id", getOrderById);

// Адмінські маршрути
router.post("/", authenticateToken, requireRole("ADMIN"), createOrder);
router.put("/:id", authenticateToken, requireRole("ADMIN"), updateOrder);
router.delete("/:id", authenticateToken, requireRole("ADMIN"), deleteOrder);

module.exports = router;
