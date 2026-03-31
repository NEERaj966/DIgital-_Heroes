import mongoose from "mongoose";

const getMongoUri = () => {
    const mongoUri = String(process.env.MONGODB_URI || process.env.MONGO_URI || "").trim();

    if (!mongoUri) {
        throw new Error("MongoDB URI is missing. Set MONGODB_URI in server/.env.");
    }

    const placeholderTokens = ["<db_user>", "<db_password>", "<cluster-url>"];
    const hasPlaceholderValue = placeholderTokens.some((token) => mongoUri.includes(token));

    if (hasPlaceholderValue) {
        throw new Error("MongoDB URI still contains placeholder values. Update MONGODB_URI in server/.env.");
    }

    if (!/^mongodb(\+srv)?:\/\//.test(mongoUri)) {
        throw new Error("MongoDB URI must start with mongodb:// or mongodb+srv://.");
    }

    return mongoUri;
};

const connectDB = async () => {
    const mongoUri = getMongoUri();

    try {
        const connectionInstance = await mongoose.connect(mongoUri, {
            serverSelectionTimeoutMS: 10000,
        });

        console.log(`\nMongoDB connected. DB HOST: ${connectionInstance.connection.host}`);
        return connectionInstance;
    } catch (error) {
        console.error("MongoDB connection failed:", error.message);
        throw error;
    }
};

mongoose.connection.on("error", (error) => {
    console.error("MongoDB connection error:", error.message);
});

mongoose.connection.on("disconnected", () => {
    console.warn("MongoDB disconnected.");
});

export default connectDB
