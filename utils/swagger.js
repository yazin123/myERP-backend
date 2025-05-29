const swaggerJsdoc = require('swagger-jsdoc');

const options = {
    definition: {
        openapi: '3.0.0',
        info: {
            title: 'Nesa ERP API Documentation',
            version: '1.0.0',
            description: 'API documentation for the Nesa ERP system',
            contact: {
                name: 'API Support',
                email: 'support@nesaerp.com'
            }
        },
        servers: [
            {
                url: process.env.NODE_ENV === 'production' 
                    ? 'https://api.nesaerp.com' 
                    : 'http://localhost:5000',
                description: process.env.NODE_ENV === 'production' ? 'Production server' : 'Development server'
            }
        ],
        components: {
            securitySchemes: {
                bearerAuth: {
                    type: 'http',
                    scheme: 'bearer',
                    bearerFormat: 'JWT'
                }
            }
        },
        security: [{
            bearerAuth: []
        }]
    },
    apis: [
        './routes/**/*.js',
        './models/**/*.js',
        './controllers/**/*.js'
    ]
};

const swaggerSpec = swaggerJsdoc(options);

module.exports = swaggerSpec; 