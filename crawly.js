//Load environment variables from crawly.env
require("dotenv").config({path:"./crawly.env"});

//Trouble Shooting: Check if the key is loaded correctly
console.log("Key loaded:", process.env.FIRECRAWL_API_KEY); 

//Import the necessary modules
const FirecrawlApp = require("@mendable/firecrawl-js").default;
const fs = require("fs");
const path = require("path");

//Initialize the FirecrawlApp with the API key and debug mode enabled
const app = new FirecrawlApp({
    apiKey: process.env.FIRECRAWL_API_KEY,
    debug: true
});

//Define the schema for the job posting data
const jobSchema = {
    type: "object",
    properties: {
        jobTitle: { type: "string" },
        location: { type: "string" },
        employmentType: { type: "string", description: "e.g. Full-time, Part-time, Contract" },
        workArrangement: { type: "string", description: "Remote, In-person, or Hybrid" },
        salary: { type: "string", description: "Salary or salary range if mentioned, otherwise null" },
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

//Main function to scrape the job posting and save the result
async function main() {
    const url = "https://drive.co.za/join-the-team/junior-software-developer";

    const result = await app.scrape(url, {
        formats: ["markdown", { type: "json", schema: jobSchema }]
    });

    const structured = result.json ?? {};

    const payload = {
        scrapedAt: new Date().toISOString(),
        sourceUrl: url,
        pageTitle: result.metadata?.title ?? null,
        ...structured,
        rawMarkdown: result.markdown
    };

    const outputPath = path.join(__dirname, "output.json");
    fs.writeFileSync(outputPath, JSON.stringify(payload, null, 2), "utf-8");

    console.log("Saved scrape result to", outputPath);
}

//Execute the main function
main();