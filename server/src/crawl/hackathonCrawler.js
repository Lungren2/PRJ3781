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
const outputPath = path.join(__dirname, "../../../public/data/hackathons.json");
const poolPath = path.join(__dirname, "hackathonsPool.json");
const statePath = path.join(__dirname, "hackathonSearchState.json");

//Set the crawler limits
const targetHackathons = 120;
const displayCount = 50;
const maxNewHackathonsPerRun = 30;
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
    "Find active hackathons accepting registrations in South Africa. Include in-person and online events, student hackathons, university competitions, and open innovation challenges. Return direct links to individual hackathon event pages.",
    "Find upcoming online hackathons open to participants in South Africa, including international virtual hackathons. Return direct links to individual events and registration pages.",
    "Find upcoming AI, machine learning, data science, and generative AI hackathons that people in South Africa can participate in. Include online events and return direct links to individual events.",
    "Find upcoming software development, web development, app development, cybersecurity, cloud, and fintech hackathons open to South African participants. Return direct links to individual events.",
    "Find upcoming university, student, beginner-friendly, startup, sustainability, and innovation hackathons in South Africa. Include registration deadlines and direct event links."
];

//Define additional search modifiers to discover different results
const searchModifiers = [
    "Prioritize events with registration currently open.",
    "Prioritize events happening soon and include registration deadlines.",
    "Search event platforms, university websites, and organizer websites.",
    "Look for online events open to international participants.",
    "Find additional events not covered by previous searches."
];

//Define the schema for the hackathon data
const hackathonSchema = {
    type: "object",
    properties: {
        title: { type: "string" },
        organizer: { type: "string" },
        description: { type: "string" },
        location: { type: "string" },
        format: {
            type: "string",
            description: "Online, In-person, or Hybrid"
        },
        startDate: {
            type: "string",
            description: "Event start date as stated by the source"
        },
        endDate: {
            type: "string",
            description: "Event end date as stated by the source"
        },
        registrationDeadline: {
            type: "string",
            description: "Registration deadline as stated by the source"
        },
        eligibility: {
            type: "string",
            description: "Who can participate, including age, location, student, or experience restrictions"
        },
        themes: {
            type: "array",
            items: { type: "string" },
            description: "Topics, tracks, and challenge themes"
        },
        prizes: {
            type: "string",
            description: "Prizes, grants, or other awards if stated"
        },
        teamRequirements: {
            type: "string",
            description: "Team size and collaboration requirements if stated"
        },
        registrationUrl: {
            type: "string",
            description: "Direct registration URL if available"
        }
    },
    required: ["title"]
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

//Load the saved hackathons from a file
async function loadHackathons(filePath = poolPath) {
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

//Check that a scraped page looks like a real hackathon listing
function isValidHackathon(hackathon) {
    const title = hackathon.title?.trim();

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

//Check whether an event has already finished or closed registration
function isHackathonExpired(hackathon) {
    const dates = [hackathon.endDate, hackathon.registrationDeadline]
        .map((value) => Date.parse(value ?? ""))
        .filter((value) => !Number.isNaN(value));

    //Keep events whose dates can't be read
    if (dates.length === 0) return false;

    //An event is expired once its latest known date has passed
    return Math.max(...dates) < Date.now();
}

//Check a saved hackathon, skipping events that were verified recently
async function isHackathonAlive(hackathon) {
    if (isHackathonExpired(hackathon)) {
        return false;
    }

    const recheckAfter = urlRecheckHours * 60 * 60 * 1000;

    if (hackathon.lastCheckedAt && Date.now() - hackathon.lastCheckedAt < recheckAfter) {
        return true;
    }

    const alive = await isUrlAlive(hackathon.sourceUrl);

    if (alive) {
        hackathon.lastCheckedAt = Date.now();
    }

    return alive;
}

//Build a key to detect likely duplicate hackathons
function getHackathonKey(hackathon) {
    const normalizeText = (value) =>
        (value ?? "").trim().toLowerCase().replace(/\s+/g, " ");

    const title = normalizeText(hackathon.title);
    const organizer = normalizeText(hackathon.organizer);
    const startDate = normalizeText(hackathon.startDate);

    return `${title}|${organizer}|${startDate}`;
}

//Save a hackathon collection to a file
async function saveHackathons(hackathons, filePath = poolPath) {
    await fs.mkdir(path.dirname(filePath), { recursive: true });

    await fs.writeFile(
        filePath,
        JSON.stringify(hackathons, null, 2),
        "utf8"
    );
}

//Pick the least recently shown hackathons and remove any whose URL is dead or expired
async function selectDisplayHackathons(hackathons) {
    //Shuffle first so hackathons that were never shown are picked in a random order
    const candidates = shuffle(hackathons).sort(
        (a, b) => (a.lastShownAt ?? 0) - (b.lastShownAt ?? 0)
    );

    const selected = [];
    const deadUrls = new Set();
    let cursor = 0;

    //Keep checking candidates until enough live hackathons are found
    while (selected.length < displayCount && cursor < candidates.length) {
        const chunk = candidates.slice(
            cursor,
            cursor + (displayCount - selected.length)
        );

        cursor += chunk.length;

        const results = await Promise.all(
            chunk.map(async (hackathon) => ({
                hackathon,
                alive: await isHackathonAlive(hackathon)
            }))
        );

        for (const { hackathon, alive } of results) {
            if (alive) {
                hackathon.lastShownAt = Date.now();
                selected.push(hackathon);
            } else {
                deadUrls.add(normalizeUrl(hackathon.sourceUrl));
                console.log(`Removed dead or expired link: ${hackathon.sourceUrl}`);
            }
        }
    }

    //Remove the dead hackathons from the saved collection
    for (let i = hackathons.length - 1; i >= 0; i--) {
        if (deadUrls.has(normalizeUrl(hackathons[i].sourceUrl))) {
            hackathons.splice(i, 1);
        }
    }

    return selected;
}

//Quickly show a fresh set of hackathons without crawling (call this when the page is refreshed)
export async function refreshHackathons() {
    const hackathons = await loadHackathons(poolPath);
    const selected = await selectDisplayHackathons(hackathons);

    await saveHackathons(hackathons, poolPath);
    await saveHackathons(selected, outputPath);

    return selected;
}

//Main function that discovers, scrapes, and saves hackathons
export async function main() {
    //Load existing hackathons before searching, falling back to the old output file
    let payload = await loadHackathons(poolPath);

    if (payload.length === 0) {
        payload = await loadHackathons(outputPath);
    }

    //Keep only hackathons with valid titles and source URLs
    const validExistingHackathons = payload.filter(
        (hackathon) => isValidHackathon(hackathon) && hackathon.sourceUrl
    );

    //Remove existing duplicate URLs and duplicate hackathon details
    const seenUrls = new Set();
    const seenHackathonKeys = new Set();

    const hackathons = validExistingHackathons.filter((hackathon) => {
        const url = normalizeUrl(hackathon.sourceUrl);
        const key = getHackathonKey(hackathon);

        if (
            !url ||
            seenUrls.has(url) ||
            seenHackathonKeys.has(key)
        ) {
            return false;
        }

        seenUrls.add(url);
        seenHackathonKeys.add(key);

        return true;
    });

    //Show a fresh set of live hackathons straight away while the crawler tops up the collection
    const firstSelection = await selectDisplayHackathons(hackathons);

    await saveHackathons(hackathons, poolPath);
    await saveHackathons(firstSelection, outputPath);

    //Rebuild the duplicate trackers because dead hackathons were removed
    seenUrls.clear();
    seenHackathonKeys.clear();

    for (const hackathon of hackathons) {
        seenUrls.add(normalizeUrl(hackathon.sourceUrl));
        seenHackathonKeys.add(getHackathonKey(hackathon));
    }

    //Track URLs already attempted during this run
    const attemptedUrls = new Set(seenUrls);

    //Track how many searches have failed to find new hackathons
    let searchesWithoutProgress = 0;
    let searchAttempts = 0;
    let addedThisRun = 0;
    let stopForRateLimit = false;

    //Load the saved prompt index
    let searchIndex = await getSearchIndex();

    console.log(`Starting hackathons: ${hackathons.length}/${targetHackathons}`);

    //Keep searching until the target is reached or results are exhausted
    while (
        hackathons.length < targetHackathons &&
        addedThisRun < maxNewHackathonsPerRun &&
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
        console.log(`Current hackathons: ${hackathons.length}/${targetHackathons}`);

        //Search the web for new hackathon URLs
        let searchResults;

        try {
            searchResults = await retryRequest(
                "Hackathon search",
                () => app.search(searchQuery, {
                    limit: urlsPerSearch,
                    country: "ZA"
                })
            );
        } catch (error) {
            console.error("Hackathon search failed:", error.message);

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

        //Scrape the discovered hackathon URLs several at a time
        let addedThisSearch = 0;

        for (let i = 0; i < batchUrls.length; i += scrapeConcurrency) {
            //Stop adding hackathons once the target is reached
            if (
                hackathons.length >= targetHackathons ||
                addedThisRun >= maxNewHackathonsPerRun ||
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
                        "Hackathon scrape",
                        () => app.scrape(url, {
                            formats: [
                                "markdown",
                                { type: "json", schema: hackathonSchema }
                            ]
                        })
                    );

                    //Extract the structured hackathon details
                    const structured = result.json ?? {};

                    //Skip pages that aren't valid hackathon listings
                    if (!isValidHackathon(structured)) {
                        console.log("Skipped invalid listing");
                        return;
                    }

                    //Build the saved hackathon object
                    const hackathon = {
                        scrapedAt: new Date().toISOString(),
                        sourceUrl: url,
                        pageTitle: result.metadata?.title ?? "",
                        title: structured.title.trim(),
                        organizer: structured.organizer?.trim() ?? "",
                        description: structured.description ?? "",
                        location: structured.location ?? "",
                        format: structured.format ?? "",
                        startDate: structured.startDate ?? "",
                        endDate: structured.endDate ?? "",
                        registrationDeadline: structured.registrationDeadline ?? "",
                        eligibility: structured.eligibility ?? "",
                        themes: Array.isArray(structured.themes)
                            ? structured.themes
                            : [],
                        prizes: structured.prizes ?? "",
                        teamRequirements: structured.teamRequirements ?? "",
                        registrationUrl: structured.registrationUrl ?? "",
                        rawMarkdown: result.markdown ?? "",
                        lastCheckedAt: Date.now(),
                        lastShownAt: 0
                    };

                    //Skip events that have already finished
                    if (isHackathonExpired(hackathon)) {
                        console.log(`Skipped expired hackathon: ${hackathon.title}`);
                        return;
                    }

                    //Check URL and hackathon details for duplicates
                    const key = getHackathonKey(hackathon);

                    if (
                        seenUrls.has(normalized) ||
                        seenHackathonKeys.has(key)
                    ) {
                        console.log(`Skipped duplicate hackathon: ${hackathon.title}`);
                        return;
                    }

                    //Skip the hackathon if another scrape already filled the target
                    if (
                        hackathons.length >= targetHackathons ||
                        addedThisRun >= maxNewHackathonsPerRun
                    ) {
                        return;
                    }

                    //Add the new unique hackathon to the collection
                    seenUrls.add(normalized);
                    seenHackathonKeys.add(key);
                    hackathons.push(hackathon);
                    addedThisSearch++;
                    addedThisRun++;

                    console.log(`Added: ${hackathon.title}`);
                    console.log(`Progress: ${hackathons.length}/${targetHackathons}`);
                } catch (error) {
                    console.error(`Failed to scrape ${url}:`, error.message);

                    //Stop scraping if Firecrawl is rate-limiting us
                    if (isRateLimitError(error)) {
                        stopForRateLimit = true;
                    }
                }
            }));

            //Save progress after each group of scrapes
            await saveHackathons(hackathons, poolPath);

            //Pause between scrape groups to reduce request pressure
            await sleep(delayBetweenScrapes);
        }

        //Save the updated hackathon collection after processing the batch
        await saveHackathons(hackathons, poolPath);

        //Track whether this search found any new hackathons
        if (addedThisSearch === 0) {
            searchesWithoutProgress++;

            console.log(
                `No new hackathons found (${searchesWithoutProgress}/${maxSearchesWithoutProgress} unsuccessful searches)`
            );
        } else {
            searchesWithoutProgress = 0;
        }

        //Rotate the category for the next search
        searchAttempts++;
        searchIndex = (searchIndex + 1) % searchPrompts.length;
        await saveSearchIndex(searchIndex);

        //Stop if the target has been reached
        if (hackathons.length >= targetHackathons) {
            break;
        }

        //Stop if Firecrawl is rate-limiting us
        if (stopForRateLimit) {
            break;
        }

        //Pause between searches
        await sleep(delayBetweenSearches);
    }

    //Save the final hackathon collection and the hackathons shown on the page
    const finalSelection = await selectDisplayHackathons(hackathons);

    await saveHackathons(hackathons, poolPath);
    await saveHackathons(finalSelection, outputPath);

    console.log("");
    console.log(`Finished with ${hackathons.length} unique hackathons (${finalSelection.length} shown).`);

    if (hackathons.length >= targetHackathons) {
        console.log("Target reached.");
    } else if (stopForRateLimit) {
        console.warn(
            "Stopped because Firecrawl rate-limited the crawler. Saved progress is preserved."
        );
    } else if (addedThisRun >= maxNewHackathonsPerRun) {
        console.log("Run limit reached. More hackathons will be added on the next run.");
    } else {
        console.warn(
            "Stopped because repeated searches produced no new unique hackathons."
        );
        console.warn(
            "Try again later or expand the search sources to find more events."
        );
    }
}

//Run the crawler when this file is executed directly
if (path.resolve(process.argv[1] ?? "") === __filename) {
    main().catch((error) => {
        console.error("Hackathon crawler failed:", error.message);
    });
}