// inspect-drive\src\lib\dbConnect.ts

import mongoose from 'mongoose';

const MONGODB_URI = process.env.MONGODB_URI;
if (!MONGODB_URI) {
  throw new Error('Please define the MONGODB_URI environment variable in .env.local');
}

interface MongooseCache {
  conn: typeof mongoose | null;
  promise: Promise<typeof mongoose> | null;
}

declare global {
  // สร้าง global variable สำหรับ cache mongoose connection
  // eslint-disable-next-line no-var
  var mongooseCache: MongooseCache | undefined;
}

// ถ้าไม่มี global cache ให้สร้างใหม่
const cached: MongooseCache = global.mongooseCache || { conn: null, promise: null };
if (!global.mongooseCache) {
  global.mongooseCache = cached;
}

async function dbConnect() {
  try {
    // ถ้ามีการเชื่อมต่ออยู่แล้ว ให้คืน instance เดิม
    if (cached.conn) {
      console.log('Already connected to MongoDB');
      return cached.conn;
    }
    // ถ้ายังไม่มี promise สำหรับการเชื่อมต่อ ให้สร้างใหม่
    if (!cached.promise) {
      console.log('Connecting to MongoDB...');
      cached.promise = mongoose.connect(MONGODB_URI as string).then((mongoose) => mongoose);
    }
    cached.conn = await cached.promise;
    console.log('Connected to MongoDB');
    return cached.conn;
  } catch (error) {
    console.error('Error connecting to MongoDB:', error);
    throw error;
  }
}

export default dbConnect;
