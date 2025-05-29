const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const logger = require('../utils/logger');

let mongoServer;

// Connect to the in-memory database before running tests
beforeAll(async () => {
    try {
        mongoServer = await MongoMemoryServer.create();
        const mongoUri = mongoServer.getUri();
        await mongoose.connect(mongoUri);
        logger.info('Connected to in-memory MongoDB');
    } catch (error) {
        logger.error('Error connecting to in-memory MongoDB:', error);
        throw error;
    }
});

// Clear all test data after each test
afterEach(async () => {
    const collections = mongoose.connection.collections;
    for (const key in collections) {
        const collection = collections[key];
        await collection.deleteMany();
    }
});

// Disconnect and stop the server after all tests are done
afterAll(async () => {
    await mongoose.disconnect();
    await mongoServer.stop();
    logger.info('Disconnected from in-memory MongoDB');
});

// Global test timeout
jest.setTimeout(30000); 