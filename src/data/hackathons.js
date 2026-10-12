
//Load the hackathons from hackathons.json
export async function getHackathons() {
    const response = await fetch("/data/hackathons.json");

    if (!response.ok) {
        throw new Error("Failed to load hackathons.json");
    }

    const data = await response.json();

    return data
        .filter((hackathon) => hackathon.title)
        .map((hackathon, index) => ({
            id: `${index}-${hackathon.title}`,
            title: hackathon.title,
            organizer: hackathon.organizer || "Unknown Organizer",
            description: hackathon.description || "No description available",
            location: hackathon.location || "Location not specified",
            format: normalizeFormat(hackathon.format),
            startDate: hackathon.startDate || "Not specified",
            endDate: hackathon.endDate || "Not specified",
            registrationDeadline:
                hackathon.registrationDeadline || "Not specified",
            eligibility: hackathon.eligibility || "Check event details",
            themes: hackathon.themes || [],
            prizes: hackathon.prizes || "Not specified",
            teamRequirements: hackathon.teamRequirements || "Not specified",
            registrationUrl:
                hackathon.registrationUrl || hackathon.sourceUrl || "",
            sourceUrl: hackathon.sourceUrl || "",
        }));
}

//Normalize the event format
function normalizeFormat(format) {
    if (!format) return "Not specified";

    const value = format.toLowerCase();

    if (value.includes("online") || value.includes("virtual")) {
        return "Online";
    }

    if (value.includes("hybrid")) {
        return "Hybrid";
    }

    if (
        value.includes("in-person") ||
        value.includes("in person") ||
        value.includes("onsite") ||
        value.includes("on-site")
    ) {
        return "In-person";
    }

    return format;
}