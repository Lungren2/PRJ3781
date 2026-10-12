import mongoose from "mongoose";

const UserSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true
    },

    email: {
      type: String,
      required: true,
      unique: true
    },

    role: {
      type: String,
      enum: ["student", "company", "department", "admin"],
      default: "student"
    },

    department: String
  },
  { timestamps: true }
);

export default mongoose.model("User", UserSchema);