// Import the necessary modules
import dotenv from "dotenv";
import FirecrawlApp from "@mendable/firecrawl-js";
import fs from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";

// Set up __filename and __dirname because they are not automatically available in ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables from jobCrawler.env
dotenv.config({
    path: path.join(__dirname, "../../../jobCrawler.env")
});

// Check that the API key is loaded
if (!process.env.FIRECRAWL_API_KEY) {
    throw new Error(
        "FIRECRAWL_API_KEY is missing. Check the path to jobCrawler.env."
    );
}

console.log("Key loaded:", !!process.env.FIRECRAWL_API_KEY);

// Initialize Firecrawl
const app = new FirecrawlApp({
    apiKey: process.env.FIRECRAWL_API_KEY,
    debug: true
});

// Set up file paths
const outputPath = path.join(__dirname, "../../../public/data/courses.json");
const poolPath = path.join(__dirname, "coursesPool.json");
const statePath = path.join(__dirname, "courseSearchState.json");

// Set the crawler limits
const targetCourses = 120;
const displayCount = 50;
const maxNewCoursesPerRun = 30;
const urlsPerSearch = 20;
const maxSearchesWithoutProgress = 5;
const maxRequestAttempts = 3;
const scrapeConcurrency = 5;
const urlCheckTimeout = 8000;
const urlRecheckHours = 6;
const delayBetweenScrapes = 300;
const delayBetweenSearches = 1000;

// Define the search prompts
const searchPrompts = [
    "Find online programming and software development courses available to students in South Africa. Include beginner, intermediate, and advanced courses. Return direct links to individual course pages.",
    "Find online artificial intelligence, machine learning, data science, and data analytics courses. Include free and paid courses available in South Africa. Return direct course links.",
    "Find cybersecurity, networking, cloud computing, and DevOps courses available online to South African learners. Include beginner-friendly courses and certifications.",
    "Find web development, frontend, backend, full-stack, mobile app development, and database courses. Include course providers, prices if available, and direct course links.",
    "Find technology career-development courses, professional IT certifications, university short courses, and technical training programmes available to South African learners."
];

// Define additional search modifiers
const searchModifiers = [
    "Prioritize courses currently available for enrolment.",
    "Include free courses and clearly stated paid courses.",
    "Prefer official course provider pages over third-party summaries.",
    "Include course duration, certification details, and prerequisites where available.",
    "Find additional courses not covered by previous searches."
];

// Define the schema for course data
const courseSchema = {
    type: "object",
    properties: {
        title: {
            type: "string",
            description: "Official name of the course"
        },
        provider: {
            type: "string",
            description: "Organization or platform offering the course"
        },
        description: {
            type: "string",
            description: "Summary of what the course teaches"
        },
        category: {
            type: "string",
            description: "Subject area, such as Programming, AI, or Cybersecurity"
        },
        level: {
            type: "string",
            description: "Beginner, Intermediate, Advanced, or All levels"
        },
        format: {
            type: "string",
            description: "Online, In-person, or Hybrid"
        },
        duration: {
            type: "string",
            description: "Course duration as stated by the provider"
        },
        price: {
            type: "string",
            description: "Course price or Free if explicitly stated"
        },
        certificate: {
            type: "string",
            description: "Certificate or qualification offered, if stated"
        },
        prerequisites: {
            type: "string",
            description: "Entry requirements or prior knowledge required"
        },
        skills: {
            type: "array",
            items: { type: "string" },
            description: "Skills taught or technologies covered"
        },
        courseUrl: {
            type: "string",
            description: "Direct URL to the course page"
        }
    },
    required: ["title"]
};

// Load the previous prompt index
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

// Save the next prompt index for the next run
async function saveSearchIndex(index) {
    await fs.writeFile(
        statePath,
        JSON.stringify({ index }, null, 2),
        "utf8"
    );
}

// Load the saved courses from a file
async function loadCourses(filePath = poolPath) {
    try {
        const data = JSON.parse(await fs.readFile(filePath, "utf8"));

        return Array.isArray(data) ? data : [];
    } catch (error) {
        if (error.code === "ENOENT") return [];
        throw error;
    }
}

// Normalize URLs so duplicate links can be detected
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

// Check that a scraped page looks like a real course listing
function isValidCourse(course) {
    const title = course.title?.trim();

    if (!title || title.length < 3) return false;

    const invalidTitles = [
        "not found",
        "page not found",
        "404 error",
        "access denied",
        "page unavailable",
        "error 404"
    ];

    if (invalidTitles.some((text) => title.toLowerCase().includes(text))) {
        return false;
    }

    return true;
}

// Wait before retrying requests or moving to the next URL
function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

// Shuffle a list so ties are broken randomly
function shuffle(list) {
    const shuffled = [...list];

    for (let i = shuffled.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));

        [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }

    return shuffled;
}

// Check whether an error is probably caused by rate limiting
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

// Retry a failed request with increasing delays
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

// Check whether a saved URL still points to a live page
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

        // Only the headers are needed so the body is discarded
        await response.body?.cancel();

        // Only treat the page as dead when it is clearly gone
        return response.status !== 404 && response.status !== 410;
    } catch (error) {
        // Treat unknown domains as dead but keep URLs that only timed out or blocked us
        return error.name === "AbortError" || error.cause?.code !== "ENOTFOUND";
    } finally {
        clearTimeout(timer);
    }
}

// Check a saved course, skipping courses that were verified recently
async function isCourseAlive(course) {
    const recheckAfter = urlRecheckHours * 60 * 60 * 1000;

    if (course.lastCheckedAt && Date.now() - course.lastCheckedAt < recheckAfter) {
        return true;
    }

    const alive = await isUrlAlive(course.sourceUrl);

    if (alive) {
        course.lastCheckedAt = Date.now();
    }

    return alive;
}

// Build a key to detect likely duplicate courses
function getCourseKey(course) {
    const normalizeText = (value) =>
        (value ?? "").trim().toLowerCase().replace(/\s+/g, " ");

    return `${normalizeText(course.title)}|${normalizeText(course.provider)}`;
}

// Save a course collection to a file
async function saveCourses(courses, filePath = poolPath) {
    await fs.mkdir(path.dirname(filePath), { recursive: true });

    await fs.writeFile(
        filePath,
        JSON.stringify(courses, null, 2),
        "utf8"
    );
}

// Pick the least recently shown courses and remove any whose URL is dead
async function selectDisplayCourses(courses) {
    // Shuffle first so courses that were never shown are picked in a random order
    const candidates = shuffle(courses).sort(
        (a, b) => (a.lastShownAt ?? 0) - (b.lastShownAt ?? 0)
    );

    const selected = [];
    const deadUrls = new Set();
    let cursor = 0;

    // Keep checking candidates until enough live courses are found
    while (selected.length < displayCount && cursor < candidates.length) {
        const chunk = candidates.slice(
            cursor,
            cursor + (displayCount - selected.length)
        );

        cursor += chunk.length;

        const results = await Promise.all(
            chunk.map(async (course) => ({
                course,
                alive: await isCourseAlive(course)
            }))
        );

        for (const { course, alive } of results) {
            if (alive) {
                course.lastShownAt = Date.now();
                selected.push(course);
            } else {
                deadUrls.add(normalizeUrl(course.sourceUrl));
                console.log(`Removed dead link: ${course.sourceUrl}`);
            }
        }
    }

    // Remove the dead courses from the saved collection
    for (let i = courses.length - 1; i >= 0; i--) {
        if (deadUrls.has(normalizeUrl(courses[i].sourceUrl))) {
            courses.splice(i, 1);
        }
    }

    return selected;
}

// Quickly show a fresh set of courses without crawling (call this when the page is refreshed)
export async function refreshCourses() {
    const courses = await loadCourses(poolPath);
    const selected = await selectDisplayCourses(courses);

    await saveCourses(courses, poolPath);
    await saveCourses(selected, outputPath);

    return selected;
}

// Main function that discovers, scrapes, and saves courses
export async function main() {
    // Load existing courses before searching, falling back to the old output file
    let payload = await loadCourses(poolPath);

    if (payload.length === 0) {
        payload = await loadCourses(outputPath);
    }

    // Keep only courses with valid titles and source URLs
    const validExistingCourses = payload.filter(
        (course) => isValidCourse(course) && course.sourceUrl
    );

    // Remove existing duplicate URLs and duplicate course details
    const seenUrls = new Set();
    const seenCourseKeys = new Set();

    const courses = validExistingCourses.filter((course) => {
        const url = normalizeUrl(course.sourceUrl);
        const key = getCourseKey(course);

        if (
            !url ||
            seenUrls.has(url) ||
            seenCourseKeys.has(key)
        ) {
            return false;
        }

        seenUrls.add(url);
        seenCourseKeys.add(key);

        return true;
    });

    // Show a fresh set of live courses straight away while the crawler tops up the collection
    const firstSelection = await selectDisplayCourses(courses);

    await saveCourses(courses, poolPath);
    await saveCourses(firstSelection, outputPath);

    // Rebuild the duplicate trackers because dead courses were removed
    seenUrls.clear();
    seenCourseKeys.clear();

    for (const course of courses) {
        seenUrls.add(normalizeUrl(course.sourceUrl));
        seenCourseKeys.add(getCourseKey(course));
    }

    // Track URLs already attempted during this run
    const attemptedUrls = new Set(seenUrls);

    // Track how many searches have failed to find new courses
    let searchesWithoutProgress = 0;
    let searchAttempts = 0;
    let addedThisRun = 0;
    let stopForRateLimit = false;

    // Load the saved prompt index
    let searchIndex = await getSearchIndex();

    console.log(`Starting courses: ${courses.length}/${targetCourses}`);

    // Keep searching until the target is reached or results are exhausted
    while (
        courses.length < targetCourses &&
        addedThisRun < maxNewCoursesPerRun &&
        searchesWithoutProgress < maxSearchesWithoutProgress
    ) {
        const modifierIndex =
            Math.floor(searchAttempts / searchPrompts.length) %
            searchModifiers.length;

        const searchQuery =
            `${searchPrompts[searchIndex]} ${searchModifiers[modifierIndex]}`;

        console.log("");
        console.log(
            `Search ${searchAttempts + 1}: category ${searchIndex + 1}/${searchPrompts.length}`
        );
        console.log(`Current courses: ${courses.length}/${targetCourses}`);

        // Search the web for new course URLs
        let searchResults;

        try {
            searchResults = await retryRequest(
                "Course search",
                () => app.search(searchQuery, {
                    limit: urlsPerSearch,
                    country: "ZA"
                })
            );
        } catch (error) {
            console.error("Course search failed:", error.message);

            if (isRateLimitError(error)) {
                stopForRateLimit = true;
                break;
            }

            searchesWithoutProgress++;
            searchAttempts++;

            searchIndex = (searchIndex + 1) % searchPrompts.length;
            await saveSearchIndex(searchIndex);
            await sleep(delayBetweenSearches);

            continue;
        }

        // Extract URLs and remove duplicate search results
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

        // Scrape the discovered course URLs several at a time
        let addedThisSearch = 0;

        for (let i = 0; i < batchUrls.length; i += scrapeConcurrency) {
            if (
                courses.length >= targetCourses ||
                addedThisRun >= maxNewCoursesPerRun ||
                stopForRateLimit
            ) {
                break;
            }

            const chunk = batchUrls.slice(i, i + scrapeConcurrency);

            await Promise.all(chunk.map(async (url) => {
                const normalized = normalizeUrl(url);
                attemptedUrls.add(normalized);

                try {
                    console.log(`Scraping: ${url}`);

                    const result = await retryRequest(
                        "Course scrape",
                        () => app.scrape(url, {
                            formats: [
                                "markdown",
                                { type: "json", schema: courseSchema }
                            ]
                        })
                    );

                    const structured = result.json ?? {};

                    // Skip pages that aren't valid course listings
                    if (!isValidCourse(structured)) {
                        console.log("Skipped invalid listing");
                        return;
                    }

                    // Build the saved course object
                    const course = {
                        scrapedAt: new Date().toISOString(),
                        sourceUrl: url,
                        pageTitle: result.metadata?.title ?? "",
                        title: structured.title.trim(),
                        provider: structured.provider?.trim() ?? "",
                        description: structured.description ?? "",
                        category: structured.category ?? "",
                        level: structured.level ?? "",
                        format: structured.format ?? "",
                        duration: structured.duration ?? "",
                        price: structured.price ?? "",
                        certificate: structured.certificate ?? "",
                        prerequisites: structured.prerequisites ?? "",
                        skills: Array.isArray(structured.skills)
                            ? structured.skills
                            : [],
                        courseUrl: structured.courseUrl || url,
                        rawMarkdown: result.markdown ?? "",
                        lastCheckedAt: Date.now(),
                        lastShownAt: 0
                    };

                    // Check URL and course details for duplicates
                    const key = getCourseKey(course);

                    if (
                        seenUrls.has(normalized) ||
                        seenCourseKeys.has(key)
                    ) {
                        console.log(`Skipped duplicate course: ${course.title}`);
                        return;
                    }

                    // Skip the course if another scrape already filled the target
                    if (
                        courses.length >= targetCourses ||
                        addedThisRun >= maxNewCoursesPerRun
                    ) {
                        return;
                    }

                    // Add the new unique course to the collection
                    seenUrls.add(normalized);
                    seenCourseKeys.add(key);
                    courses.push(course);
                    addedThisSearch++;
                    addedThisRun++;

                    console.log(`Added: ${course.title}`);
                    console.log(`Progress: ${courses.length}/${targetCourses}`);
                } catch (error) {
                    console.error(`Failed to scrape ${url}:`, error.message);

                    if (isRateLimitError(error)) {
                        stopForRateLimit = true;
                    }
                }
            }));

            // Save progress after each group of scrapes
            await saveCourses(courses, poolPath);

            await sleep(delayBetweenScrapes);
        }

        // Save the updated course collection after processing the batch
        await saveCourses(courses, poolPath);

        if (addedThisSearch === 0) {
            searchesWithoutProgress++;

            console.log(
                `No new courses found (${searchesWithoutProgress}/${maxSearchesWithoutProgress} unsuccessful searches)`
            );
        } else {
            searchesWithoutProgress = 0;
        }

        // Rotate the category for the next search
        searchAttempts++;
        searchIndex = (searchIndex + 1) % searchPrompts.length;
        await saveSearchIndex(searchIndex);

        if (courses.length >= targetCourses) {
            break;
        }

        if (stopForRateLimit) {
            break;
        }

        await sleep(delayBetweenSearches);
    }

    // Save the final course collection and the courses shown on the page
    const finalSelection = await selectDisplayCourses(courses);

    await saveCourses(courses, poolPath);
    await saveCourses(finalSelection, outputPath);

    console.log("");
    console.log(`Finished with ${courses.length} unique courses (${finalSelection.length} shown).`);

    if (courses.length >= targetCourses) {
        console.log("Target reached.");
    } else if (stopForRateLimit) {
        console.warn(
            "Stopped because Firecrawl rate-limited the crawler. Saved progress is preserved."
        );
    } else if (addedThisRun >= maxNewCoursesPerRun) {
        console.log("Run limit reached. More courses will be added on the next run.");
    } else {
        console.warn(
            "Stopped because repeated searches produced no new unique courses."
        );
        console.warn(
            "Try again later or expand the search sources to find more listings."
        );
    }
}

// Run the crawler when this file is executed directly
if (path.resolve(process.argv[1] ?? "") === __filename) {
    main().catch((error) => {
        console.error("Course crawler failed:", error.message);
    });
}