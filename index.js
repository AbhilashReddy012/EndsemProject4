// Simple global variables (Using let/const for modern best practices)
let profileData = null;
let reposData = [];

/*SECURITY NOTE: this token is visible to anyone who opens devtools on the
// deployed site. Use a token with NO scopes checked (reading public data
// needs no scope — auth alone raises the limit to 5,000/hr) and give it an
// expiration date. Never paste a token with repo/admin/write scopes here.*/

const GITHUB_TOKEN = "YOUR_GITHUB_TOKEN_HERE";
const hasToken = GITHUB_TOKEN && GITHUB_TOKEN !== "YOUR_GITHUB_TOKEN_HERE";
const githubHeaders = { Authorization: "Bearer " + GITHUB_TOKEN };

// Wrapper around fetch: attaches the token if one is set, and if GitHub
// rejects it (401 Bad credentials) falls back to an unauthenticated request
// instead of breaking the whole search.
async function githubFetch(url) {
    let response = await fetch(url, hasToken ? { headers: githubHeaders } : undefined);
    if (response.status === 401 && hasToken) {
        console.warn("GitHub token rejected (401 Bad credentials) — retrying " + url + " without authentication. Check that GITHUB_TOKEN is a real, unexpired token with no typos.");
        response = await fetch(url);
    }
    return response;
}

// Builds a human-readable rate-limit summary from a response's headers.
// This is what actually proves whether the token is being applied: a limit
// of 60 means you're still unauthenticated no matter what GITHUB_TOKEN says;
// a limit of 5000 means the token is genuinely working.
function describeRateLimit(headers) {
    const limit = headers.get("X-RateLimit-Limit");
    const remaining = headers.get("X-RateLimit-Remaining");
    const reset = headers.get("X-RateLimit-Reset");
    if (limit === null) return "";
    const resetTime = reset ? new Date(parseInt(reset, 10) * 1000).toLocaleTimeString() : "unknown";
    const tierNote = limit === "60"
        ? " — this is the UNAUTHENTICATED tier, meaning the token in index.js is not being applied."
        : " — this is the AUTHENTICATED tier, the token IS being applied.";
    return "\n\nRate limit: " + remaining + "/" + limit + " remaining, resets at " + resetTime + "." + tierNote;
}

// One-time startup warning so it's obvious in the console whether a real
// token was ever configured, instead of finding out only after a 403.
if (!hasToken) {
    console.warn("GITHUB_TOKEN is still the placeholder — every request is unauthenticated and capped at 60/hour.");
}

// Main function to search a user
async function searchGitHubUser(username) {
    // Hide previous results
    document.getElementById("profile-area").classList.add("hidden");
    document.getElementById("repos-area").classList.add("hidden");
    try {
        // Fetch user profile data
        const userResponse = await githubFetch("https://api.github.com/users/" + username);

        // Only a 404 means the username itself doesn't exist
        if (userResponse.status === 404) {
            alert("Username not valid");
            document.getElementById("input").value = '';
            return;
        }

        // Any other non-200 (e.g. 403 rate limit, 5xx server issue) is a different problem,
        // not an invalid username — surface it, plus the actual rate-limit tier, so it's
        // never ambiguous whether the token is doing anything
        if (userResponse.status !== 200) {
            const errorBody = await userResponse.json().catch(() => ({}));
            const baseMessage = errorBody.message || ("GitHub API error: " + userResponse.status);
            alert(baseMessage + describeRateLimit(userResponse.headers));
            return;
        }

        // Save profile JSON
        profileData = await userResponse.json();

        // Fetch repository list
        const reposResponse = await githubFetch("https://api.github.com/users/" + username + "/repos");
        if (reposResponse.status !== 200) {
            const errorBody = await reposResponse.json().catch(() => ({}));
            const baseMessage = errorBody.message || ("GitHub API error: " + reposResponse.status);
            alert(baseMessage + describeRateLimit(reposResponse.headers));
            return;
        }
        reposData = await reposResponse.json();

        // Show populated HTML
        showProfile();
        showRepos();
    } catch (err) {
        console.error(err);
        alert("An error occurred while fetching data.");
    }
}

// Fill in profile details
function showProfile() {
    document.getElementById("avatar-image").src = profileData.avatar_url;
    document.getElementById("user-display-name").innerText = profileData.name || profileData.login;
    document.getElementById("user-bio").innerText = profileData.bio || "No bio available.";
    document.getElementById("stat-repos").innerText = profileData.public_repos;
    document.getElementById("stat-followers").innerText = profileData.followers;
    document.getElementById("stat-following").innerText = profileData.following;
    document.getElementById("profile-area").classList.remove("hidden");
}

// Fill in repository list items
function showRepos() {
    const listContainer = document.getElementById("repos-list");
    listContainer.innerHTML = ""; // Clear old repos

    // Display ALL repos returned by the API (no 5-item cap)
    let combinedHTML = "";
    for (let i = 0; i < reposData.length; i++) {
        const repo = reposData[i];
        const description = repo.description || "No description provided.";
        combinedHTML += `
            <div class="repo-item">
                <a href="${repo.html_url}" target="_blank" class="repo-link">${repo.name}</a>
                <p class="repo-description">${description}</p>
            </div>
        `;
    }
    // Single DOM update for better performance
    listContainer.innerHTML = combinedHTML;
    document.getElementById("repos-area").classList.remove("hidden");
}

// Search submit button action listener
document.getElementById("form").addEventListener("submit", function(e) {
    e.preventDefault(); // Stop page refresh
    const searchedUser = document.getElementById("input").value.trim();
    if (searchedUser) {
        searchGitHubUser(searchedUser);
    }
});

// Search for "abhilashreddy012" by default on initial start
window.onload = function() {
    searchGitHubUser("abhilashreddy012");
};
