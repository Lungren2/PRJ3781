//Load the jobs from jobs.json
export async function getJobs() {
    const response = await fetch('/data/jobs.json')

    if (!response.ok) {
        throw new Error('Failed to load jobs.json')
    }

    const data = await response.json()

    return data
        .filter((job) => job.jobTitle)
        .map((job, index) => ({
            id: `${index}-${job.jobTitle}`,
            company: job.company || getCompany(job.sourceUrl),
            mark: toMark(job.company || getCompany(job.sourceUrl)),
            title: job.jobTitle,
            location: job.location || 'Remote',
            mode: normalizeMode(job.workArrangement),
            type: getJobType(job),
            pay: job.salary || 'Not specified',
            posted: 'Recently',
            source: 'Crawled listing',
            tone: 'blue',
            match: 0,
            skills: job.skillsRequired || [],
            sourceUrl: job.sourceUrl,
        }))
}

//Get the company name from the URL
function getCompany(url) {
    if (url.includes('drive.co.za')) return 'Drive'
    if (url.includes('takealotgroup')) return 'Takealot'
    if (url.includes('theodo')) return 'Theodo'
    if (url.includes('the-global-talent-co')) return 'The Global Talent Co.'
    if (url.includes('translution-software')) return 'TransLution Software'

    return 'Unknown Company'
}

//Load jobs employers published on Morrow, followed by the crawled listings
export async function getAllJobs() {
    const [posted, projects, crawled] = await Promise.all([
        getPostedJobs().catch(() => []),
        getOpenProjects().catch(() => []),
        getJobs(),
    ])
    return [...posted, ...projects, ...crawled]
}

//Load short (often paid) projects that are still accepting applications
export async function getOpenProjects() {
    const response = await fetch('/api/product-requests?status=Open')

    if (!response.ok) {
        throw new Error('Failed to load projects')
    }

    const data = await response.json()

    return data
        .filter((project) => project.applicationsOpen)
        .map((project) => ({
            id: `project-${project.id}`,
            company: project.companyName,
            mark: toMark(project.companyName),
            title: project.title,
            location: project.department,
            mode: project.duration || 'Short project',
            type: 'Project',
            pay: project.pay || 'Unpaid',
            posted: project.deadline
                ? `Apply by ${new Date(project.deadline).toLocaleDateString()}`
                : postedLabel(project.createdAt),
            source: 'Project on Morrow',
            tone: 'coral',
            match: 0,
            skills: [project.category],
            href: `/projects/${project.id}`,
        }))
}

//Load published jobs from the Morrow API
export async function getPostedJobs() {
    const response = await fetch('/api/jobs')

    if (!response.ok) {
        throw new Error('Failed to load posted jobs')
    }

    const data = await response.json()

    return data.map((job) => ({
        id: `morrow-${job.id}`,
        company: job.company,
        mark: toMark(job.company),
        title: job.title,
        location: job.location,
        mode: job.workSetup,
        type: job.type,
        pay: job.pay || 'Not specified',
        posted: postedLabel(job.publishedAt),
        source: 'Posted on Morrow',
        tone: 'sage',
        match: 0,
        skills: job.skills,
        href: `/jobs/posted/${job.id}`,
    }))
}

function postedLabel(publishedAt) {
    const days = Math.floor((Date.now() - new Date(publishedAt).getTime()) / 86400000)
    if (days <= 0) return 'Posted today'
    if (days === 1) return 'Posted yesterday'
    return `Posted ${days} days ago`
}

//Get a short company mark
function toMark(company) {
    return company
        .split(' ')
        .map((word) => word[0])
        .join('')
        .slice(0, 2)
        .toUpperCase()
}

//Convert crawler work arrangements to the UI values
function normalizeMode(mode) {
    if (mode === 'In-person') return 'On-site'
    return mode || 'Flexible'
}

//Convert crawler employment information into your existing job filters
function getJobType(job) {
    const text = `${job.jobTitle} ${job.skillsRequired?.join(' ')}`.toLowerCase()

    if (
        text.includes('intern') ||
        text.includes('graduate') ||
        text.includes('junior') ||
        text.includes('entry')
    ) {
        return 'Entry level'
    }

    if (job.employmentType?.toLowerCase().includes('part')) {
        return 'Part-time'
    }

    return 'Full-time'
}