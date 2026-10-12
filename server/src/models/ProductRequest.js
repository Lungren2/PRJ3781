import mongoose from "mongoose";

export const PRODUCT_REQUEST_STATUSES = ["Open", "In Progress", "Completed"];

export const APPLICANT_STATUSES = ["applied", "selected", "completed", "declined"];

export const PRODUCT_REQUEST_CATEGORIES = [
  "Web Development",
  "Mobile Development",
  "UI/UX Design",
  "Data Analysis",
  "Research",
  "Marketing",
  "General"
];

// A short, usually paid, project posted by an employer organization that
// candidates apply to.
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

    // Copied from the organization when the request is posted.
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
      enum: PRODUCT_REQUEST_CATEGORIES,
      default: "General"
    },

    // Free text, e.g. "R3 000 fixed" or "R250 / hour". Empty means unpaid.
    pay: {
      type: String,
      default: ""
    },

    // Expected length of the work, e.g. "2 weeks".
    duration: {
      type: String,
      default: ""
    },

    deadline: Date,

    status: {
      type: String,
      enum: PRODUCT_REQUEST_STATUSES,
      default: "Open"
    },

    organization: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Organization",
      required: true,
      index: true
    },

    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true
    },

    applicants: [
      {
        _id: false,
        user: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "User",
          required: true
        },
        appliedAt: {
          type: Date,
          default: Date.now
        },
        // Set by the posting organization. "completed" projects appear on the
        // candidate's portfolio as verified Morrow work.
        status: {
          type: String,
          enum: APPLICANT_STATUSES,
          default: "applied"
        },
        statusChangedAt: Date
      }
    ]
  },
  { timestamps: true }
);

export default mongoose.model("ProductRequest", ProductRequestSchema);
