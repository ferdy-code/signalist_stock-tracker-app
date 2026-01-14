import mongoose from "mongoose";

const MONGODB_URI = process.env.MONGODB_URI;

async function testConnection() {
  console.log("Testing database connection...\n");

  if (!MONGODB_URI) {
    console.error("MONGODB_URI is not set in environment variables");
    process.exit(1);
  }

  try {
    await mongoose.connect(MONGODB_URI);
    console.log("Database connection successful!");
    console.log(`Connected to: ${mongoose.connection.host}`);
    console.log(`Database name: ${mongoose.connection.name}`);
    console.log(`Connection state: ${mongoose.connection.readyState === 1 ? "Connected" : "Disconnected"}`);
  } catch (error) {
    console.error("Database connection failed!");
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  } finally {
    await mongoose.disconnect();
    console.log("\nConnection closed.");
  }
}

testConnection();
