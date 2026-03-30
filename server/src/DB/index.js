import mongoose from "mongoose";

const connectDB = async () => {
    const mongoUri = process.env.MONGODB_URI?.trim();

    if (!mongoUri) {
        throw new Error("MONGODB_URI is missing. Check server/.env");
    }

    try {
        const connectionInstance = await mongoose.connect(mongoUri, {
            serverSelectionTimeoutMS: 5000,
        });

        console.log(`\nMongoDB connected. DB HOST: ${connectionInstance.connection.host}`);
        return connectionInstance;
    } catch (error) {
        console.log("MONGODB connection FAILED", error.message);
        throw error;
    }
};

export default connectDB
