//Import the necessary modules
import dotenv from "dotenv";
import FirecrawlApp from "@mendable/firecrawl-js";
import fs from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";

//Set up __filename and __dirname because they are not automatically available in ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

//Load environment variables from jobCrawler.env
dotenv.config({
    path: path.join(__dirname, "../../../jobCrawler.env")
});

//Trouble Shooting: Check if the key is loaded correctly
console.log("Key loaded:", !!process.env.FIRECRAWL_API_KEY);

//Initialize the FirecrawlApp with the API key and debug mode enabled
const app = new FirecrawlApp({
    apiKey: process.env.FIRECRAWL_API_KEY,
    debug: true
});

//Set up file paths
const outputPath = path.join(__dirname, "../../../public/data/jobs.json");
const poolPath = path.join(__dirname, "jobsPool.json");
const statePath = path.join(__dirname, "searchState.json");

//Set the crawler limits
const targetJobs = 120;
const displayCount = 50;
const maxNewJobsPerRun = 30;
const urlsPerSearch = 20;
const maxSearchesWithoutProgress = 5;
const maxRequestAttempts = 3;
const scrapeConcurrency = 5;
const urlCheckTimeout = 8000;
const urlRecheckHours = 6;
const delayBetweenScrapes = 300;
const delayBetweenSearches = 1000;

//Define the search prompts
const searchPrompts = [
    "Find active software developer and software engineer job listings in South Africa, including junior, graduate, and entry-level positions. Return direct links to individual job adverts.",
    "Find active data analyst, data engineer, machine learning, and AI developer jobs in South Africa, including graduate and junior opportunities. Return direct links to individual job adverts.",
    "Find active cybersecurity analyst, SOC analyst, penetration tester, IT support, and network engineer jobs in South Africa. Include entry-level roles and return direct links to individual job adverts.",
    "Find active cloud engineer, DevOps engineer, systems administrator, site reliability engineer, and platform engineer jobs in South Africa. Return direct links to individual job adverts.",
    "Find active frontend developer, backend developer, full-stack developer, mobile app developer, and UI/UX designer jobs in South Africa. Include junior opportunities and return direct links to individual job adverts."
];

//Define additional search modifiers to discover different results
const searchModifiers = [
    "Prioritize recently posted vacancies.",
    "Prefer direct employer career pages and individual job adverts.",
    "Focus on graduate, junior, and entry-level opportunities.",
    "Search different job boards and company recruitment websites.",
    "Find additional active vacancies not covered by previous searches."
];

//Define the schema for the job posting data
const jobSchema = {
    type: "object",
    properties: {
        jobTitle: { type: "string" },
        company: {
            type: "string",
            description: "Name of the company offering the job"
        },
        location: { type: "string" },
        employmentType: {
            type: "string",
            description: "e.g. Full-time, Part-time, Contract"
        },
        workArrangement: {
            type: "string",
            description: "Remote, In-person, or Hybrid"
        },
        salary: {
            type: "string",
            description: "Salary or salary range if mentioned, otherwise not specified"
        },
        skillsRequired: {
            type: "array",
            items: { type: "string" },
            description: "List of required or preferred skills, qualifications, and technologies"
        },
        responsibilities: {
            type: "array",
            items: { type: "string" }
        },
        howToApply: { type: "string" }
    },
    required: ["jobTitle", "skillsRequired"]
};

//Load the previous prompt index
async function getSearchIndex() {
    try {
        const state = JSON.parse(await fs.readFile(statePath, "utf8"));

        return Number.isInteger(state.index) && state.index >= 0
            ? state.index % searchPrompts.length
            : 0;
    } catch {
        return 0;
    }
}

//Save the next prompt index for the next run
async function saveSearchIndex(index) {
    await fs.writeFile(
        statePath,
        JSON.stringify({ index }, null, 2),
        "utf8"
    );
}

//Load the saved jobs from a file
async function loadJobs(filePath = poolPath) {
    try {
        const data = JSON.parse(await fs.readFile(filePath, "utf8"));

        return Array.isArray(data) ? data : [];
    } catch (error) {
        if (error.code === "ENOENT") return [];
        throw error;
    }
}

//Normalize URLs so duplicate links can be detected
function normalizeUrl(url) {
    try {
        const parsed = new URL(url);

        parsed.hash = "";
        parsed.search = "";

        return parsed.href.replace(/\/$/, "").toLowerCase();
    } catch {
        return "";
    }
}

//Check that a scraped page looks like a real job listing
function isValidJob(job) {
    const title = job.jobTitle?.trim();

    if (!title || title.length < 3) return false;

    const invalidTitles = [
        "not found",
        "page not found",
        "404 error",
        "jobs at",
        "access denied",
        "page unavailable",
        "access denied",
        "error 404"
    ];

    if (invalidTitles.some((text) => title.toLowerCase().includes(text))) {
        return false;
    }

    return true;
}

//Wait before retrying requests or moving to the next URL
function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

//Shuffle a list so ties are broken randomly
function shuffle(list) {
    const shuffled = [...list];

    for (let i = shuffled.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));

        [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }

    return shuffled;
}

//Check whether an error is probably caused by rate limiting
function isRateLimitError(error) {
    const message =
        `${error.status ?? ""} ${error.statusCode ?? ""} ${error.message ?? ""}`
            .toLowerCase();

    return (
        message.includes("429") ||
        message.includes("rate limit") ||
        message.includes("too many requests") ||
        message.includes("quota exceeded") ||
        message.includes("plan limit")
    );
}

//Retry a failed request with increasing delays
async function retryRequest(label, request) {
    for (let attempt = 1; attempt <= maxRequestAttempts; attempt++) {
        try {
            return await request();
        } catch (error) {
            if (attempt === maxRequestAttempts || isRateLimitError(error)) {
                throw error;
            }

            const delay = 3000 * attempt;

            console.warn(
                `${label} failed. Retrying in ${delay / 1000} seconds.`
            );

            await sleep(delay);
        }
    }
}

//Check whether a saved URL still points to a live page
async function isUrlAlive(url) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), urlCheckTimeout);

    try {
        const response = await fetch(url, {
            method: "GET",
            redirect: "follow",
            signal: controller.signal,
            headers: { "User-Agent": "Mozilla/5.0" }
        });

        //Only the headers are needed so the body is discarded
        await response.body?.cancel();

        //Only treat the page as dead when it is clearly gone
        return response.status !== 404 && response.status !== 410;
    } catch (error) {
        //Treat unknown domains as dead but keep URLs that only timed out or blocked us
        return error.name === "AbortError" || error.cause?.code !== "ENOTFOUND";
    } finally {
        clearTimeout(timer);
    }
}

//Check a saved job, skipping jobs that were verified recently
async function isJobAlive(job) {
    const recheckAfter = urlRecheckHours * 60 * 60 * 1000;

    if (job.lastCheckedAt && Date.now() - job.lastCheckedAt < recheckAfter) {
        return true;
    }

    const alive = await isUrlAlive(job.sourceUrl);

    if (alive) {
        job.lastCheckedAt = Date.now();
    }

    return alive;
}

//Build a key to detect likely duplicate job adverts
function getJobKey(job) {
    const normalizeText = (value) =>
        (value ?? "").trim().toLowerCase().replace(/\s+/g, " ");

    const title = normalizeText(job.jobTitle);
    const location = normalizeText(job.location);

    //Use the company name when it is available
    let company = normalizeText(job.company);

    //Use the source website as a fallback when the company isn't known
    if (!company && job.sourceUrl) {
        try {
            company = new URL(job.sourceUrl).hostname
                .replace(/^www\./, "")
                .toLowerCase();
        } catch {
            company = "";
        }
    }

    return `${title}|${company}|${location}`;
}

//Save a job collection to a file
async function saveJobs(jobs, filePath = poolPath) {
    await fs.mkdir(path.dirname(filePath), { recursive: true });

    await fs.writeFile(
        filePath,
        JSON.stringify(jobs, null, 2),
        "utf8"
    );
}

//Pick the least recently shown jobs and remove any whose URL is dead
async function selectDisplayJobs(jobs) {
    //Shuffle first so jobs that were never shown are picked in a random order
    const candidates = shuffle(jobs).sort(
        (a, b) => (a.lastShownAt ?? 0) - (b.lastShownAt ?? 0)
    );

    const selected = [];
    const deadUrls = new Set();
    let cursor = 0;

    //Keep checking candidates until enough live jobs are found
    while (selected.length < displayCount && cursor < candidates.length) {
        const chunk = candidates.slice(
            cursor,
            cursor + (displayCount - selected.length)
        );

        cursor += chunk.length;

        const results = await Promise.all(
            chunk.map(async (job) => ({
                job,
                alive: await isJobAlive(job)
            }))
        );

        for (const { job, alive } of results) {
            if (alive) {
                job.lastShownAt = Date.now();
                selected.push(job);
            } else {
                deadUrls.add(normalizeUrl(job.sourceUrl));
                console.log(`Removed dead link: ${job.sourceUrl}`);
            }
        }
    }

    //Remove the dead jobs from the saved collection
    for (let i = jobs.length - 1; i >= 0; i--) {
        if (deadUrls.has(normalizeUrl(jobs[i].sourceUrl))) {
            jobs.splice(i, 1);
        }
    }

    return selected;
}

//Quickly show a fresh set of jobs without crawling (call this when the page is refreshed)
export async function refreshJobs() {
    const jobs = await loadJobs(poolPath);
    const selected = await selectDisplayJobs(jobs);

    await saveJobs(jobs, poolPath);
    await saveJobs(selected, outputPath);

    return selected;
}

//Main function that discovers, scrapes, and saves jobs
export async function main() {
    //Load existing jobs before searching, falling back to the old output file
    let payload = await loadJobs(poolPath);

    if (payload.length === 0) {
        payload = await loadJobs(outputPath);
    }

    //Keep only jobs with valid titles and source URLs
    const validExistingJobs = payload.filter(
        (job) => isValidJob(job) && job.sourceUrl
    );

    //Remove existing duplicate URLs and duplicate job details
    const seenUrls = new Set();
    const seenJobKeys = new Set();

    const jobs = validExistingJobs.filter((job) => {
        const url = normalizeUrl(job.sourceUrl);
        const jobKey = getJobKey(job);

        if (
            !url ||
            seenUrls.has(url) ||
            seenJobKeys.has(jobKey)
        ) {
            return false;
        }

        seenUrls.add(url);
        seenJobKeys.add(jobKey);

        return true;
    });

    //Show a fresh set of live jobs straight away while the crawler tops up the collection
    const firstSelection = await selectDisplayJobs(jobs);

    await saveJobs(jobs, poolPath);
    await saveJobs(firstSelection, outputPath);

    //Rebuild the duplicate trackers because dead jobs were removed
    seenUrls.clear();
    seenJobKeys.clear();

    for (const job of jobs) {
        seenUrls.add(normalizeUrl(job.sourceUrl));
        seenJobKeys.add(getJobKey(job));
    }

    //Track URLs already attempted during this run
    const attemptedUrls = new Set(seenUrls);

    //Track how many searches have failed to find new jobs
    let searchesWithoutProgress = 0;
    let searchAttempts = 0;
    let addedThisRun = 0;
    let stopForRateLimit = false;

    //Load the saved prompt index
    let searchIndex = await getSearchIndex();

    console.log(`Starting jobs: ${jobs.length}/${targetJobs}`);

    //Keep searching until the target is reached or results are exhausted
    while (
        jobs.length < targetJobs &&
        addedThisRun < maxNewJobsPerRun &&
        searchesWithoutProgress < maxSearchesWithoutProgress
    ) {
        //Choose a search modifier and rotate through the categories
        const modifierIndex =
            Math.floor(searchAttempts / searchPrompts.length) %
            searchModifiers.length;

        const searchQuery =
            `${searchPrompts[searchIndex]} ${searchModifiers[modifierIndex]}`;

        console.log("");
        console.log(
            `Search ${searchAttempts + 1}: category ${searchIndex + 1}/${searchPrompts.length}`
        );
        console.log(`Current jobs: ${jobs.length}/${targetJobs}`);

        //Search the web for new job URLs
        let searchResults;

        try {
            searchResults = await retryRequest(
                "Job search",
                () => app.search(searchQuery, {
                    limit: urlsPerSearch,
                    country: "ZA"
                })
            );
        } catch (error) {
            console.error("Job search failed:", error.message);

            //Stop requesting the API if it is rate-limiting us
            if (isRateLimitError(error)) {
                stopForRateLimit = true;
                break;
            }

            searchesWithoutProgress++;
            searchAttempts++;

            //Rotate to the next category after a failed search
            searchIndex = (searchIndex + 1) % searchPrompts.length;
            await saveSearchIndex(searchIndex);

            //Pause before trying another search
            await sleep(delayBetweenSearches);

            continue;
        }

        //Extract URLs and remove duplicate search results
        const results = (searchResults.web ?? [])
            .map((result) => result.url)
            .filter(Boolean);

        const batchUrls = [];
        const batchSeen = new Set();

        for (const url of results) {
            const normalized = normalizeUrl(url);

            if (
                !normalized ||
                attemptedUrls.has(normalized) ||
                batchSeen.has(normalized)
            ) {
                continue;
            }

            batchSeen.add(normalized);
            batchUrls.push(url);

            if (batchUrls.length >= urlsPerSearch) {
                break;
            }
        }

        console.log(`Search results returned: ${results.length}`);
        console.log(`New URLs discovered: ${batchUrls.length}`);

        //Scrape the discovered job URLs several at a time
        let addedThisSearch = 0;

        for (let i = 0; i < batchUrls.length; i += scrapeConcurrency) {
            //Stop adding jobs once the target is reached
            if (
                jobs.length >= targetJobs ||
                addedThisRun >= maxNewJobsPerRun ||
                stopForRateLimit
            ) {
                break;
            }

            const chunk = batchUrls.slice(i, i + scrapeConcurrency);

            await Promise.all(chunk.map(async (url) => {
                const normalized = normalizeUrl(url);

                //Mark this URL before scraping so it isn't repeated in this run
                attemptedUrls.add(normalized);

                try {
                    console.log(`Scraping: ${url}`);

                    const result = await retryRequest(
                        "Job scrape",
                        () => app.scrape(url, {
                            formats: [
                                "markdown",
                                { type: "json", schema: jobSchema }
                            ]
                        })
                    );

                    //Extract the structured job details
                    const structured = result.json ?? {};

                    //Skip pages that aren't valid job listings
                    if (!isValidJob(structured)) {
                        console.log("Skipped invalid or closed listing");
                        return;
                    }

                    //Build the saved job object
                    const job = {
                        scrapedAt: new Date().toISOString(),
                        sourceUrl: url,
                        pageTitle: result.metadata?.title ?? "",
                        jobTitle: structured.jobTitle.trim(),
                        company: structured.company?.trim() ?? "",
                        location: structured.location ?? "",
                        employmentType: structured.employmentType ?? "",
                        workArrangement: structured.workArrangement ?? "",
                        salary: structured.salary ?? "",
                        skillsRequired: Array.isArray(structured.skillsRequired)
                            ? structured.skillsRequired
                            : [],
                        responsibilities: Array.isArray(structured.responsibilities)
                            ? structured.responsibilities
                            : [],
                        howToApply: structured.howToApply ?? "",
                        rawMarkdown: result.markdown ?? "",
                        lastCheckedAt: Date.now(),
                        lastShownAt: 0
                    };

                    //Check URL and job details for duplicates
                    const jobKey = getJobKey(job);

                    if (
                        seenUrls.has(normalized) ||
                        seenJobKeys.has(jobKey)
                    ) {
                        console.log(`Skipped duplicate job: ${job.jobTitle}`);
                        return;
                    }

                    //Skip the job if another scrape already filled the target
                    if (
                        jobs.length >= targetJobs ||
                        addedThisRun >= maxNewJobsPerRun
                    ) {
                        return;
                    }

                    //Add the new unique job to the collection
                    seenUrls.add(normalized);
                    seenJobKeys.add(jobKey);
                    jobs.push(job);
                    addedThisSearch++;
                    addedThisRun++;

                    console.log(`Added: ${job.jobTitle}`);
                    console.log(`Progress: ${jobs.length}/${targetJobs}`);
                } catch (error) {
                    console.error(`Failed to scrape ${url}:`, error.message);

                    //Stop scraping if Firecrawl is rate-limiting us
                    if (isRateLimitError(error)) {
                        stopForRateLimit = true;
                    }
                }
            }));

            //Save progress after each group of scrapes
            await saveJobs(jobs, poolPath);

            //Pause between scrape groups to reduce request pressure
            await sleep(delayBetweenScrapes);
        }

        //Save the updated job collection after processing the batch
        await saveJobs(jobs, poolPath);

        //Track whether this search found any new jobs
        if (addedThisSearch === 0) {
            searchesWithoutProgress++;

            console.log(
                `No new jobs found (${searchesWithoutProgress}/${maxSearchesWithoutProgress} unsuccessful searches)`
            );
        } else {
            searchesWithoutProgress = 0;
        }

        //Rotate the category for the next search
        searchAttempts++;
        searchIndex = (searchIndex + 1) % searchPrompts.length;
        await saveSearchIndex(searchIndex);

        //Stop if the target has been reached
        if (jobs.length >= targetJobs) {
            break;
        }

        //Stop if Firecrawl is rate-limiting us
        if (stopForRateLimit) {
            break;
        }

        //Pause between searches
        await sleep(delayBetweenSearches);
    }

    //Save the final job collection and the jobs shown on the page
    const finalSelection = await selectDisplayJobs(jobs);

    await saveJobs(jobs, poolPath);
    await saveJobs(finalSelection, outputPath);

    console.log("");
    console.log(`Finished with ${jobs.length} unique jobs (${finalSelection.length} shown).`);

    if (jobs.length >= targetJobs) {
        console.log("Target reached.");
    } else if (stopForRateLimit) {
        console.warn(
            "Stopped because Firecrawl rate-limited the crawler. Saved progress is preserved."
        );
    } else if (addedThisRun >= maxNewJobsPerRun) {
        console.log("Run limit reached. More jobs will be added on the next run.");
    } else {
        console.warn(
            "Stopped because repeated searches produced no new unique jobs."
        );
        console.warn(
            "Try again later or expand the search sources to find more listings."
        );
    }
}

//Run the crawler when this file is executed directly
if (path.resolve(process.argv[1] ?? "") === __filename) {
    main().catch((error) => {
        console.error("Crawler failed:", error.message);
    });
}