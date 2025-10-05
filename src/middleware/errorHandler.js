const errorHandler = (error, req, res, next) => {
  console.error("Error:", error);

  if (error.code === "P2002") return res.status(400).json({ error: "Duplicate entry" });
  if (error.code === "P2025") return res.status(404).json({ error: "Not found" });
  if (error.name === "JsonWebTokenError") return res.status(401).json({ error: "Invalid token" });
  if (error.name === "ValidationError") return res.status(400).json({ error: error.message });

  res.status(500).json({
    error: "Internal server error",
    message: process.env.NODE_ENV === "development" ? error.message : "Something went wrong",
  });
};

module.exports = errorHandler;
