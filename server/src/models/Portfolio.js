import mongoose from "mongoose";

export const PORTFOLIO_ENTRY_KINDS = ["project", "experience"];

// A candidate's portfolio page. Private until `published` is switched on; then
// anyone with the link /portfolio/<slug> can view it.
const PortfolioSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      unique: true
    },

    // The public link name, e.g. "robin-basson".
    slug: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true
    },

    published: {
      type: Boolean,
      default: false
    },

    displayName: String,
    headline: String,
    about: String,
    skills: [String],

    links: {
      linkedin: String,
      github: String,
      website: String
    },

    // Education comes from the candidate's resume profile; verified work from
    // completed Morrow projects. These switches hide either section.
    showEducation: {
      type: Boolean,
      default: true
    },

    showMorrowWork: {
      type: Boolean,
      default: true
    },

    // Projects and experience the candidate adds themselves, in display order.
    entries: [
      {
        kind: {
          type: String,
          enum: PORTFOLIO_ENTRY_KINDS,
          required: true
        },
        title: String,
        organisation: String,
        role: String,
        startDate: String,
        endDate: String,
        description: String,
        url: String,
        hidden: {
          type: Boolean,
          default: false
        }
      }
    ]
  },
  { timestamps: true }
);

export default mongoose.model("Portfolio", PortfolioSchema);
