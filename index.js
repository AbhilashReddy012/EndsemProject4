// Simple global variables (Using let/const for modern best practices)
let profileData = null;
let reposData = [];

/* SECURITY NOTE: This token is visible to anyone who opens devtools on the
 deployed site. Only use a token with NO scopes checked (read-only public
 data doesn't need any scope — auth alone raises the limit to 5,000/hr) and
 set an expiration date when you generate it. Never use a token with repo,
 admin, or write scopes here. */
const GITHUB_TOKEN = "YOUR_GITHUB_TOKEN_HERE";

// Shared headers for authenticated GitHub API requests
const githubHeaders = {
    Authorization: "Bearer " + GITHUB_TOKEN
};

// Main function to search a user
async function searchGitHubUser(username) {
    // Hide previous results
    document.getElementById("profile-area").classList.add("hidden");
    document.getElementById("repos-area").classList.add("hidden");
    try {
        // Fetch user profile data
        const userResponse = await fetch("https://api.github.com/users/" + username, {
            headers: githubHeaders
        });

        // Only a 404 means the username itself doesn't exist
        if (userResponse.status === 404) {
            alert("Username not valid");
            document.getElementById("input").value = '';
            return;
        }

        // Any other non-200 (e.g. 403 rate limit, 5xx server issue) is a different problem,
        // not an invalid username — surface it so it isn't misdiagnosed
        if (userResponse.status !== 200) {
            const errorBody = await userResponse.json().catch(() => ({}));
            alert(errorBody.message || ("GitHub API error: " + userResponse.status));
            return;
        }

        // Save profile JSON
        profileData = await userResponse.json();

        // Fetch repository list
        const reposResponse = await fetch("https://api.github.com/users/" + username + "/repos", {
            headers: githubHeaders
        });
        if (reposResponse.status !== 200) {
            const errorBody = await reposResponse.json().catch(() => ({}));
            alert(errorBody.message || ("GitHub API error: " + reposResponse.status));
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

    // Display ALL repos returned by the API (limit removed)
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
