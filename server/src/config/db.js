/**
 * MongoDB 连接(单例)。
 * 本地开发连 127.0.0.1;CloudBase 部署时由 env.mongoUri 指向云数据库。
 */
import mongoose from 'mongoose';
import { env } from './env.js';

let connected = false;

export async function connectDB() {
  if (connected) return mongoose.connection;
  mongoose.set('strictQuery', true);
  await mongoose.connect(env.mongoUri, {
    serverSelectionTimeoutMS: 5000,
  });
  connected = true;
  console.log(`[db] 已连接 MongoDB`);
  return mongoose.connection;
}

export function getDB() {
  return mongoose.connection.db;
}
