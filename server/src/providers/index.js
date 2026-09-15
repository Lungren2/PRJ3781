import * as microsoftLearn from './microsoft-learn.js'
import * as coursera from './coursera.js'
import * as devpost from './devpost.js'

// Udemy is deliberately absent. www.udemy.com returns HTTP 403 to non-browser
// clients — even for robots.txt — which is an explicit refusal of automated access.
// Working around that would mean defeating bot protection, so the answer is simply
// not to crawl them. If Morrow is ever accepted into Udemy's affiliate programme,
// add an adapter that uses their Affiliate API with issued credentials.
export const providers = [microsoftLearn, coursera, devpost]

export function getProvider(providerId) {
  return providers.find((provider) => provider.id === providerId)
}

export function enabledProviders() {
  return providers.filter((provider) => provider.enabled())
}
