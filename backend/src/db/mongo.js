const mongoose = require('mongoose');

let mongoConnected = false;

async function connectMongo() {
    const mongoUri = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/disaster_relief';

    try {
        if (mongoose.connection.readyState === 1) {
            mongoConnected = true;
            return true;
        }

        await mongoose.connect(mongoUri, {
            serverSelectionTimeoutMS: 3000
        });
        mongoConnected = true;
        console.log(`MongoDB connected: ${mongoUri}`);
        return true;
    } catch (error) {
        mongoConnected = false;
        console.warn(`MongoDB unavailable (${mongoUri}). Falling back to JSON files.`, error.message);
        return false;
    }
}

function isMongoConnected() {
    return mongoConnected && mongoose.connection.readyState === 1;
}

module.exports = {
    connectMongo,
    isMongoConnected,
    mongoose
};
