const socket = io();
const userInfo = document.getElementById('user-info');
const userData = {};

document.addEventListener('DOMContentLoaded', (event) => {
    const posts = document.querySelectorAll('.post');
    posts.forEach(post => {
        post.addEventListener('click', () => {
            console.log(post.id);
            window.location.href = `/post/${post.id}`;
        });
    });
});




async function fetchUser() {
    try {
        let response = await fetch('/getuser/');
        let data = await response.json();
        console.log(data, "hello");
        Object.assign(userData, data);
        showUserInfo(data);
    } catch (error) {
        console.error('Error:', error);
    }
}

function showUserInfo(user) {
    userInfo.innerHTML = `<div class="user-info">
    <div class="user-info-title">User Info</div>
    <div class="user-info-content">
        <div class="user-info-username">Username: ${user.username}</div>
        <div class="user-info-email">Email: ${user.email}</div>
        </div>
    </div>`;
}






async function fetchNavbar() {
    try {
        let response = await fetch('/navbar');
        let navbarHtml = await response.text();
        document.getElementById('navbar').innerHTML = navbarHtml;
    } catch (error) {
        console.error('Error fetching navbar:', error);
    }
}
fetchNavbar();
fetchUser();
