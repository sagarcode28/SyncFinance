import mongoose from 'mongoose';
import config from './index.js';
import * as dotenv from 'dotenv';

// Force load environment variables
dotenv.config();

export async function connectDatabase(): Promise<void> {
  try {
    mongoose.set('strictQuery', true);
    
    // Grab the URI directly from process.env to ensure it's not undefined
    // Fall back to config.mongodbUri just in case
    const uri = process.env.MONGODB_URI || config.mongodbUri;

    if (!uri) {
      throw new Error("MongoDB URI is undefined! Check your .env file.");
    }
    
    await mongoose.connect(uri, {
      maxPoolSize: 10,
      serverSelectionTimeoutMS: 5000,
      socketTimeoutMS: 45000,
    });
    
    console.log('✅ MongoDB connected successfully');
    
    mongoose.connection.on('error', (error) => {
      console.error('MongoDB connection error:', error);
    });
    
    mongoose.connection.on('disconnected', () => {
      console.warn('MongoDB disconnected. Attempting to reconnect...');
    });
    
    mongoose.connection.on('reconnected', () => {
      console.log('MongoDB reconnected');
    });
    
  } catch (error: any) {
    console.error(`❌ MongoDB connection failed to ${process.env.MONGODB_URI || config.mongodbUri}`);
    console.error(error.message);
    
    if (config.nodeEnv === 'development') {
      console.log('⚠️ Falling back to In-Memory MongoDB for local development...');
      try {
        const { MongoMemoryServer } = await import('mongodb-memory-server');
        const mongoServer = await MongoMemoryServer.create();
        const mongoUri = mongoServer.getUri();
        
        await mongoose.connect(mongoUri);
        console.log('✅ In-Memory MongoDB connected successfully at', mongoUri);
      } catch (memError) {
        console.error('❌ Failed to start In-Memory MongoDB:', memError);
        process.exit(1);
      }
    } else {
      process.exit(1);
    }
  }
}

export async function disconnectDatabase(): Promise<void> {
  try {
    await mongoose.disconnect();
    console.log('MongoDB disconnected');
  } catch (error) {
    console.error('Error disconnecting MongoDB:', error);
  }
}

export default mongoose;
