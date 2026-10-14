import mongoose from 'mongoose'
import '../config.js'
import CandidateResume from '../models/CandidateResume.js'
import Job from '../models/Job.js'
import ProductRequest from '../models/ProductRequest.js'
import Organization from '../models/Organization.js'
import Portfolio from '../models/Portfolio.js'
import Session from '../models/Session.js'
import User from '../models/User.js'

// Add required indexes without dropping indexes from an existing database.
export async function connectMongoDB(uri = process.env.MONGODB_URI) {
  try {
    console.log('MongoDB URI loaded:', !!uri)

    await mongoose.connect(uri)
    await Promise.all(
      [User, Organization, Session, Job, CandidateResume, ProductRequest, Portfolio].map((model) =>
        model.createIndexes(),
      ),
    )

    console.log('MongoDB connected')
  } catch (error) {
    console.error('MongoDB connection failed:', error.message)
    process.exit(1)
  }
}

export async function disconnectMongoDB() {
  await mongoose.disconnect()
}
