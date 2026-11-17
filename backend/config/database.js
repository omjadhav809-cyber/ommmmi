import mongoose from 'mongoose';

export async function connectDatabase() {
  const { MONGODB_URI } = process.env;
  if (!MONGODB_URI) {
    console.warn('MONGODB_URI is not set. Database features will be unavailable.');
    return;
  }

  mongoose.set('strictQuery', true);
  await mongoose.connect(MONGODB_URI, { serverSelectionTimeoutMS: 15000 });
  console.log('Connected to MongoDB Atlas successfully.');
}
