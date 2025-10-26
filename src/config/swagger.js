const swaggerJsdoc = require('swagger-jsdoc');

const options = {
    definition: {
        openapi: '3.0.0',
        info: {
            title: 'API Documentation',
            version: '1.0.0',
            description: 'API documentation for the web application',
            contact: { name: 'API Support', email: 'support@example.com' }
        },
        servers: [
            {
                url: process.env.NODE_ENV === 'production'
                    ? 'https://lab1-web-programming.onrender.com' // твій продакшн URL
                    : 'http://localhost:3000',
                description: process.env.NODE_ENV === 'production'
                    ? 'Production server'
                    : 'Development server'
            }
        ],
        components: {
            securitySchemes: {
                bearerAuth: {
                    type: 'http',
                    scheme: 'bearer',
                    bearerFormat: 'JWT',
                    description: 'Enter your JWT token'
                }
            },
            schemas: {
                Error: { type: 'object', properties: { error: { type: 'string' } } },
                User: {
                    type: 'object',
                    properties: {
                        id: { type: 'integer' },
                        email: { type: 'string', format: 'email' },
                        name: { type: 'string' },
                        role: { type: 'string', enum: ['USER', 'ADMIN', 'MODERATOR'] },
                        createdAt: { type: 'string', format: 'date-time' }
                    }
                },
                Pagination: {
                    type: 'object',
                    properties: {
                        page: { type: 'integer' },
                        limit: { type: 'integer' },
                        total: { type: 'integer' },
                        totalPages: { type: 'integer' },
                        hasMore: { type: 'boolean' }
                    }
                }
            }
        },
        tags: [
            { name: 'Authentication', description: 'Authentication operations' },
            { name: 'Files', description: 'File management' },
            { name: 'Products', description: 'Product management' },
            { name: 'Orders', description: 'Order management' },
            { name: 'Customers', description: 'Customer management' }
        ]
    },
    apis: ['./src/routes/*.js']
};

const specs = swaggerJsdoc(options);

module.exports = specs;
