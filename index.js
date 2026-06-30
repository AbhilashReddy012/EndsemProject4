// Simple global variables (Using let/const for modern best practices)
let profileData = null;
let reposData = [];

// Main function to search a user
async function searchGitHubUser(username) {
    // Hide previous results
    document.getElementById("profile-area").classList.add("hidden");
    document.getElementById("repos-area").classList.add("hidden");

    try {
        // Fetch user profile data
        const userResponse = await fetch("https://api.github.com/users/" + username);

        // If response is not OK, show native alert box and stop safely
        if (userResponse.status !== 200) {
            alert("Username not valid");
            document.getElementById("input").value = '';
            return; 
        }

        // Save profile JSON
        profileData = await userResponse.json();

        // Fetch repository list
        const reposResponse = await fetch("https://api.github.com/users/" + username + "/repos");
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

    // Display up to 5 repos safely
    const maxRepos = Math.min(5, reposData.length);
    let combinedHTML = ""; 

    for (let i = 0; i < maxRepos; i++) {
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
    searchGitHubUser("AbhilashReddy012");
};
