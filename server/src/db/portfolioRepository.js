import Portfolio from "../models/Portfolio.js";

/**
 * The candidate's portfolio, or null if they have not saved one yet.
 */
export async function getPortfolioForUser(userId) {
  return await Portfolio.findOne({ user: userId }).lean();
}

export async function findPortfolioBySlug(slug) {
  return await Portfolio.findOne({ slug }).lean();
}

/**
 * True when another user's portfolio already uses this link name.
 */
export async function isSlugTaken(slug, exceptUserId = null) {
  const query = { slug };
  if (exceptUserId) query.user = { $ne: exceptUserId };
  return Boolean(await Portfolio.exists(query));
}

/**
 * Create or replace the candidate's portfolio.
 */
export async function savePortfolio(userId, portfolio) {
  return await Portfolio.findOneAndUpdate(
    { user: userId },
    { $set: portfolio },
    { new: true, upsert: true, runValidators: true, lean: true }
  );
}
