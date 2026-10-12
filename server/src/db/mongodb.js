import mongoose from "mongoose";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";
import CandidateResume from "../models/CandidateResume.js";
import Job from "../models/Job.js";
import ProductRequest from "../models/ProductRequest.js";
import Organization from "../models/Organization.js";
import Portfolio from "../models/Portfolio.js";
import Session from "../models/Session.js";
import User from "../models/User.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Explicitly load server/.env
dotenv.config({ path: path.resolve(__dirname, "../../.env") });

/**
 * Connect to MongoDB and make each collection's indexes match its schema. Syncing
 * also drops stale indexes left by older code (e.g. the unique `entraId` index on
 * users, which would otherwise reject every second sign-up).
 */
export async function connectMongoDB(uri = process.env.MONGODB_URI) {
  try {
    console.log("MongoDB URI loaded:", !!uri);

    await mongoose.connect(uri);
    await Promise.all(
      [User, Organization, Session, Job, CandidateResume, ProductRequest, Portfolio].map((model) => model.syncIndexes())
    );

    console.log("MongoDB connected");
  } catch (error) {
    console.error("MongoDB connection failed:", error.message);
    process.exit(1);
  }
}

export async function disconnectMongoDB() {
  await mongoose.disconnect();
}
