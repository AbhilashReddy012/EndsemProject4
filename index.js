// ⚠️ SECURITY NOTE: This token is visible to anyone who opens devtools on the
// deployed site. Only use a token with NO scopes checked (read-only public
// data doesn't need any scope — auth alone raises the limit to 5,000/hr) and
// set an expiration date when you generate it. Never use a token with repo,
// admin, or write scopes here.
const GITHUB_TOKEN = "YOUR_GITHUB_TOKEN_HERE";
const hasToken = GITHUB_TOKEN && GITHUB_TOKEN !== "YOUR_GITHUB_TOKEN_HERE";
const githubHeaders = { Authorization: "Bearer " + GITHUB_TOKEN };

// Pause between each username in the queue so requests go out one after
// another instead of bursting all at once (helps avoid secondary/abuse
// rate limiting even when you're still under the per-hour cap).
const DELAY_BETWEEN_REQUESTS_MS = 800;

const resultsArea = document.getElementById("results-area");
const rateStatus = document.getElementById("rate-status");

// Wrapper around fetch that attaches the token if present, and silently
// falls back to an unauthenticated request if the token is rejected
// (401 Bad credentials) instead of breaking the whole queue.
async function githubFetch(url) {
    let response = await fetch(url, hasToken ? { headers: githubHeaders } : undefined);
    if (response.status === 401 && hasToken) {
        console.warn("GitHub token rejected (401 Bad credentials) — retrying " + url + " without authentication.");
        response = await fetch(url);
    }
    return response;
}

// Reads GitHub's rate-limit headers off any response and updates the status line
function updateRateStatus(headers) {
    const remaining = headers.get("X-RateLimit-Remaining");
    const limit = headers.get("X-RateLimit-Limit");
    const reset = headers.get("X-RateLimit-Reset");
    if (remaining === null || limit === null) return;
    const resetTime = reset ? new Date(parseInt(reset, 10) * 1000).toLocaleTimeString() : "";
    rateStatus.textContent = "API requests remaining: " + remaining + "/" + limit +
        (resetTime ? " (resets " + resetTime + ")" : "");
}

// Splits textarea input on commas or newlines, trims, removes blanks and duplicates
function parseUsernames(raw) {
    const seen = new Set();
    return raw
        .split(/[\n,]+/)
        .map(u => u.trim())
        .filter(u => u.length > 0)
        .filter(u => {
            if (seen.has(u)) return false;
            seen.add(u);
            return true;
        });
}

function delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

// Prevents bio/description text from being interpreted as HTML
function escapeHTML(str) {
    const div = document.createElement("div");
    div.textContent = str;
    return div.innerHTML;
}

function buildUserCardHTML(user, repos) {
    const reposHTML = repos.length
        ? repos.map(repo => `
            <div class="repo-item">
                <a href="${repo.html_url}" target="_blank" class="repo-link">${escapeHTML(repo.name)}</a>
                <p class="repo-description">${escapeHTML(repo.description || "No description provided.")}</p>
            </div>
        `).join("")
        : `<p class="repo-description">No public repositories.</p>`;

    return `
        <div class="pcard">
            <img class="avatar" src="${user.avatar_url}" alt="Profile Pic" />
            <h2>${escapeHTML(user.name || user.login)}</h2>
            <p class="bio">${escapeHTML(user.bio || "No bio available.")}</p>
            <div class="stats-box">
                <div><strong>${user.public_repos}</strong><p style="font-size: 11px; color: #888; margin-top: 5px;">Repos</p></div>
                <div><strong>${user.followers}</strong><p style="font-size: 11px; color: #888; margin-top: 5px;">Followers</p></div>
                <div><strong>${user.following}</strong><p style="font-size: 11px; color: #888; margin-top: 5px;">Following</p></div>
            </div>
            <div class="repos-area">
                <h3 style="margin-bottom: 15px;">Repositories</h3>
                <div class="repos-list">${reposHTML}</div>
            </div>
        </div>
    `;
}

function appendErrorCard(username, message) {
    resultsArea.insertAdjacentHTML("beforeend", `
        <div class="pcard error-card">
            <h2>${escapeHTML(username)}</h2>
            <p class="bio">${escapeHTML(message)}</p>
        </div>
    `);
}

// Fetches and renders a single username.
// Returns true if the queue should STOP (rate limit hit), false to continue.
async function fetchAndRenderUser(username) {
    try {
        const userResponse = await githubFetch("https://api.github.com/users/" + username);
        updateRateStatus(userResponse.headers);

        if (userResponse.status === 404) {
            appendErrorCard(username, "Username not valid");
            return false;
        }
        if (userResponse.status === 403 || userResponse.status === 429) {
            const reset = userResponse.headers.get("X-RateLimit-Reset");
            const resetTime = reset ? new Date(parseInt(reset, 10) * 1000).toLocaleTimeString() : "soon";
            appendErrorCard(username, "Rate limit reached. Try again after " + resetTime + ".");
            return true; // stop the rest of the queue, don't keep burning failed requests
        }
        if (userResponse.status !== 200) {
            const errorBody = await userResponse.json().catch(() => ({}));
            appendErrorCard(username, errorBody.message || ("GitHub API error: " + userResponse.status));
            return false;
        }

        const user = await userResponse.json();

        const reposResponse = await githubFetch("https://api.github.com/users/" + username + "/repos");
        updateRateStatus(reposResponse.headers);
        const repos = reposResponse.status === 200 ? await reposResponse.json() : [];

        resultsArea.insertAdjacentHTML("beforeend", buildUserCardHTML(user, repos));
        return false;
    } catch (err) {
        console.error(err);
        appendErrorCard(username, "An error occurred while fetching data.");
        return false;
    }
}

// Processes the username queue strictly one at a time, with a pause between each
async function handleSearch(rawInput) {
    const usernames = parseUsernames(rawInput);
    if (usernames.length === 0) return;

    resultsArea.innerHTML = "";
    rateStatus.textContent = "Searching " + usernames.length + " username(s)...";

    for (let i = 0; i < usernames.length; i++) {
        const stopQueue = await fetchAndRenderUser(usernames[i]);
        if (stopQueue) break;
        if (i < usernames.length - 1) {
            await delay(DELAY_BETWEEN_REQUESTS_MS);
        }
    }
}

document.getElementById("form").addEventListener("submit", function(e) {
    e.preventDefault();
    const raw = document.getElementById("input").value.trim();
    if (raw) {
        handleSearch(raw);
    }
});

// Default search on initial load
window.onload = function() {
    handleSearch("abhilashreddy012");
};
