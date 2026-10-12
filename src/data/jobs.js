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
            company: getCompany(job.sourceUrl),
            mark: getMark(job.sourceUrl),
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

//Get a short company mark
function getMark(url) {
    const company = getCompany(url)

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