const { verifyAccessToken } = require('../utils/jwt');

// Middleware to check for a valid JWT and attach user info to the request
function authenticateToken(req, res, next) {
    try {
        const authHeader = req.headers.authorization;

        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return res.status(401).json({
                error: 'Authentication token is missing'
            });
        }

        const token = authHeader.substring(7);
        const decoded = verifyAccessToken(token);

        req.user = decoded; // Adds { userId, role } to the request object
        next();
    } catch (error) {
        return res.status(401).json({
            error: 'Invalid or expired token'
        });
    }
}

// Middleware to check if the authenticated user has one of the allowed roles
function requireRole(...allowedRoles) {
    return (req, res, next) => {
        if (!req.user) {
            return res.status(401).json({
                error: 'Authentication is required'
            });
        }

        const userRole = req.user.role;
        if (!allowedRoles.includes(userRole)) {
            return res.status(403).json({
                error: 'Insufficient permissions to perform this action'
            });
        }

        next();
    };
}

module.exports = {
    authenticateToken,
    requireRole
};