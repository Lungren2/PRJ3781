import * as cheerio from 'cheerio';

// Name of the provider for your database
export const providerName = 'Devpost';

export async function crawl() {
    const url = 'https://devpost.com/hackathons';
    console.log(`[${providerName}] Starting crawl of ${url}...`);
    
    try {
        // 1. Fetch the HTML from the hackathon website
        const response = await fetch(url);
        if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
        const html = await response.text();
        
        // 2. Load HTML into Cheerio (allows us to use jQuery-like selectors)
        const $ = cheerio.load(html);
        const hackathons = [];
        
        // 3. Find all hackathon cards on the page. 
        // (If Devpost changes their website layout, these class names '.clearfix' might need updating)
        $('.hackathon-tile').each((i, element) => {
            const title = $(element).find('h3').text().trim();
            const urlPath = $(element).find('a[data-role="featured_challenge"]').attr('href');
            const dates = $(element).find('.submission-period').text().trim();
            
            // 4. If we successfully found a title and URL, add it to our list
            if (title && urlPath) {
                hackathons.push({
                    title: title,
                    url: urlPath.startsWith('http') ? urlPath : `https://${urlPath}`,
                    provider: providerName,
                    dates: dates || 'TBA'
                });
            }
        });
        
        console.log(`[${providerName}] Successfully crawled ${hackathons.length} hackathons.`);
        return hackathons;
        
    } catch (error) {
        console.error(`[${providerName}] Crawl failed:`, error.message);
        return []; // Return empty array on failure so the app doesn't crash
    }
}