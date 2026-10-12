// Load the courses from courses.json
export async function getCourses() {
    const response = await fetch("/data/courses.json");

    if (!response.ok) {
        throw new Error("Failed to load courses.json");
    }

    const data = await response.json();

    if (!Array.isArray(data)) {
        throw new Error("courses.json must contain an array of courses");
    }

    return data
        .filter((course) => course.title)
        .map((course, index) => ({
            id: `${index}-${course.title}`,
            title: course.title,
            provider: course.provider || "Unknown Provider",
            description: course.description || "No description available",
            category: course.category || "General",
            level: course.level || "Not specified",
            format: normalizeFormat(course.format),
            duration: course.duration || "Not specified",
            price: course.price || "Not specified",
            certificate: course.certificate || "Not specified",
            prerequisites: course.prerequisites || "Not specified",
            skills: Array.isArray(course.skills) ? course.skills : [],
            courseUrl: course.courseUrl || course.sourceUrl || "",
            sourceUrl: course.sourceUrl || "",
        }));
}

// Normalize the course format
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