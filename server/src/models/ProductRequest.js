import "../models/User.js";
import mongoose from "mongoose";

const ProductRequestSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: true,
      trim: true
    },

    description: {
      type: String,
      required: true
    },

    companyName: {
      type: String,
      required: true
    },

    department: {
      type: String,
      required: true
    },

    category: {
      type: String,
      default: "General"
    },

    deadline: Date,

    status: {
      type: String,
      enum: ["Open", "In Progress", "Completed"],
      default: "Open"
    },

    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User"
    },

    assignedStudents: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User"
      }
    ]
  },
  { timestamps: true }
);

export default mongoose.model("ProductRequest", ProductRequestSchema);