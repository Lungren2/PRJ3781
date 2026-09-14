// One controlled vocabulary for the three filter axes on /discover/certifications.
// Providers each publish an incompatible taxonomy of their own, so every record is
// mapped into these lists before it is stored.

export const LEVELS = [
  { id: 'beginner', label: 'Beginner' },
  { id: 'foundation', label: 'Foundation' },
  { id: 'intermediate', label: 'Intermediate' },
  { id: 'advanced', label: 'Advanced' },
  { id: 'unspecified', label: 'Not stated' },
]

export const TYPES = [
  { id: 'certification', label: 'Certification' },
  { id: 'professional-certificate', label: 'Professional certificate' },
  { id: 'specialization', label: 'Specialization' },
  { id: 'course', label: 'Course' },
  { id: 'learning-path', label: 'Learning path' },
  { id: 'guided-project', label: 'Guided project' },
]

// `coursera` entries match Coursera domainTypes (domainId or subdomainId).
// `msRoles` / `msSubjects` match Microsoft Learn roles and subject ids.
export const SKILLS = [
  {
    id: 'software-development',
    label: 'Software development',
    coursera: [
      'software-development',
      'mobile-and-web-development',
      'algorithms',
      'computer-science',
    ],
    msRoles: ['developer', 'maker'],
    msSubjects: [
      'app-development',
      'frontend-development',
      'backend-development',
      'mobile-development',
      'game-development',
      'cross-development',
    ],
    keywords: [
      'programming',
      'javascript',
      'typescript',
      'python',
      'java ',
      'c#',
      'react',
      'angular',
      'node.js',
      'full stack',
      'web development',
      'software engineering',
      'object oriented',
      'rest api',
      'git ',
    ],
  },
  {
    id: 'data-analytics',
    label: 'Data & analytics',
    coursera: [
      'data-analysis',
      'probability-and-statistics',
      'business-intelligence',
      'data-science',
    ],
    msRoles: ['data-analyst', 'data-engineer', 'business-analyst'],
    msSubjects: ['data-analytics', 'data-visualization', 'business-reporting', 'data-engineering'],
    keywords: [
      'data analysis',
      'data analytics',
      'excel',
      'tableau',
      'power bi',
      'statistics',
      'dashboard',
      'spreadsheet',
      'visualization',
      'r programming',
    ],
  },
  {
    id: 'cloud-infrastructure',
    label: 'Cloud & infrastructure',
    coursera: ['cloud-computing'],
    msRoles: [
      'administrator',
      'devops-engineer',
      'solution-architect',
      'platform-engineer',
      'technology-manager',
    ],
    msSubjects: [
      'infrastructure',
      'cloud-computing',
      'containers',
      'virtualization',
      'serverless-computing',
      'site-reliability-engineering',
      'architecture',
    ],
    keywords: [
      'aws',
      'azure',
      'google cloud',
      'kubernetes',
      'docker',
      'devops',
      'terraform',
      'serverless',
      'cloud practitioner',
      'infrastructure',
    ],
  },
  {
    id: 'cybersecurity',
    label: 'Cybersecurity',
    coursera: ['security', 'computer-security-and-networks'],
    msRoles: [
      'security-engineer',
      'security-operations-analyst',
      'identity-access-admin',
      'ip-admin',
      'privacy-manager',
      'risk-practitioner',
      'auditor',
    ],
    msSubjects: [
      'security',
      'cloud-security',
      'threat-protection',
      'identity-access',
      'compliance',
      'information-protection-governance',
      'insider-risk',
    ],
    keywords: [
      'cybersecurity',
      'cyber security',
      'information security',
      'penetration test',
      'ethical hacking',
      'threat',
      'malware',
      'siem',
      'encryption',
      'zero trust',
    ],
  },
  {
    id: 'ai-machine-learning',
    label: 'AI & machine learning',
    coursera: ['machine-learning'],
    msRoles: ['ai-engineer', 'ai-edge-engineer', 'data-scientist'],
    msSubjects: [
      'artificial-intelligence',
      'machine-learning',
      'generative-ai',
      'natural-language-processing',
      'chatbots',
      'classification-analysis',
    ],
    keywords: [
      'machine learning',
      'deep learning',
      'neural network',
      'artificial intelligence',
      'generative ai',
      'large language model',
      'nlp',
      'computer vision',
      'prompt engineering',
      'tensorflow',
      'pytorch',
    ],
  },
  {
    id: 'databases',
    label: 'Databases',
    coursera: ['data-management'],
    msRoles: ['database-administrator'],
    msSubjects: ['databases', 'data-storage', 'data-modeling', 'data-integration'],
    keywords: [
      'sql',
      'postgresql',
      'mysql',
      'mongodb',
      'database',
      'data warehouse',
      'etl',
      'nosql',
      'query optimization',
    ],
  },
  {
    id: 'networking',
    label: 'Networking',
    coursera: ['networking'],
    msRoles: ['network-engineer'],
    msSubjects: ['networking'],
    keywords: [
      'computer network',
      'tcp/ip',
      'ccna',
      'routing',
      'switching',
      'dns',
      'firewall',
      'vpn',
      'network administration',
    ],
  },
  {
    id: 'it-support',
    label: 'IT support',
    coursera: ['support-and-operations'],
    msRoles: ['support-engineer', 'service-adoption-specialist'],
    msSubjects: ['it-management-monitoring', 'device-management', 'application-management'],
    keywords: [
      'it support',
      'help desk',
      'helpdesk',
      'technical support',
      'troubleshooting',
      'system administration',
      'operating system',
    ],
  },
  {
    id: 'ux-design',
    label: 'UX & design',
    coursera: ['design-and-product'],
    msRoles: [],
    msSubjects: ['accessibility'],
    keywords: [
      'ux design',
      'ui design',
      'user experience',
      'user interface',
      'figma',
      'wireframe',
      'prototyping',
      'interaction design',
      'product design',
      'graphic design',
      'usability',
    ],
  },
  {
    id: 'product-project-management',
    label: 'Product & project management',
    coursera: ['project-management', 'leadership-and-management', 'business-essentials'],
    msRoles: ['business-owner', 'technology-manager', 'functional-consultant'],
    msSubjects: ['process-workflow', 'change-management', 'solution-design'],
    keywords: [
      'project management',
      'product management',
      'agile',
      'scrum',
      'kanban',
      'stakeholder',
      'roadmap',
      'pmp',
      'product owner',
      'business analysis',
    ],
  },
]

const SKILL_IDS = new Set(SKILLS.map((skill) => skill.id))
const TYPE_IDS = new Set(TYPES.map((type) => type.id))
const LEVEL_IDS = new Set(LEVELS.map((level) => level.id))

export const isSkillId = (value) => SKILL_IDS.has(value)
export const isTypeId = (value) => TYPE_IDS.has(value)
export const isLevelId = (value) => LEVEL_IDS.has(value)

export const skillLabel = (id) => SKILLS.find((skill) => skill.id === id)?.label ?? id
export const typeLabel = (id) => TYPES.find((type) => type.id === id)?.label ?? id
export const levelLabel = (id) => LEVELS.find((level) => level.id === id)?.label ?? id

// Weights: an explicit provider tag is a far stronger signal than a word we found
// in prose, and a title match beats a description match.
const WEIGHT_TAG = 3
const WEIGHT_TITLE = 2
const WEIGHT_DESCRIPTION = 1
const MIN_SCORE = 2
const MAX_SKILLS = 3

/**
 * Map one record onto the Morrow skill vocabulary.
 * Returns at most MAX_SKILLS ids, strongest first. An empty result means the record
 * is not technical enough to belong on the certifications page and should be dropped.
 */
export function classifySkills({ title = '', description = '', tags = [] } = {}) {
  const haystackTitle = String(title).toLowerCase()
  const haystackDescription = String(description).toLowerCase()
  const tagSet = new Set(tags.filter(Boolean).map((tag) => String(tag).toLowerCase()))

  const scored = SKILLS.map((skill) => {
    let score = 0

    const providerTags = [
      ...(skill.coursera ?? []),
      ...(skill.msRoles ?? []),
      ...(skill.msSubjects ?? []),
    ]
    for (const tag of providerTags) {
      if (tagSet.has(tag)) score += WEIGHT_TAG
    }

    for (const keyword of skill.keywords ?? []) {
      if (haystackTitle.includes(keyword)) score += WEIGHT_TITLE
      else if (haystackDescription.includes(keyword)) score += WEIGHT_DESCRIPTION
    }

    return { id: skill.id, score }
  })

  return scored
    .filter((entry) => entry.score >= MIN_SCORE)
    .sort((a, b) => b.score - a.score || a.id.localeCompare(b.id))
    .slice(0, MAX_SKILLS)
    .map((entry) => entry.id)
}

const LEVEL_PATTERNS = [
  { id: 'advanced', patterns: ['advanced', 'expert', 'mastery', 'in depth', 'in-depth'] },
  { id: 'intermediate', patterns: ['intermediate', 'associate level'] },
  { id: 'foundation', patterns: ['foundation', 'fundamentals', 'essentials', 'practitioner'] },
  {
    id: 'beginner',
    patterns: [
      'beginner',
      'introduction to',
      'intro to',
      'getting started',
      'basics',
      'for everyone',
      'no prior experience',
      '101',
    ],
  },
]

/** Normalize a provider level string, falling back to inference from title/description. */
export function normalizeLevel(rawLevel, { title = '', description = '' } = {}) {
  const raw = String(rawLevel ?? '')
    .toLowerCase()
    .trim()
  if (isLevelId(raw)) return raw
  if (raw === 'novice' || raw === 'basic') return 'beginner'
  if (raw === 'expert') return 'advanced'

  const haystack = `${title} ${description}`.toLowerCase()
  for (const { id, patterns } of LEVEL_PATTERNS) {
    if (patterns.some((pattern) => haystack.includes(pattern))) return id
  }
  return 'unspecified'
}

/** Strip the HTML that Microsoft Learn returns in `subtitle`, and collapse whitespace. */
export function stripHtml(value) {
  return String(value ?? '')
    .replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&#39;|&rsquo;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/\s+/g, ' ')
    .trim()
}

export function truncate(value, max = 320) {
  const text = String(value ?? '').trim()
  if (text.length <= max) return text
  return `${text.slice(0, max - 1).trimEnd()}…`
}
