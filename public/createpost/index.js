const postInput = document.getElementById('content');
const socket = io();








async function fetchNavbar() {
    try {
        let response = await fetch('/navbar');
        let navbarHtml = await response.text();
        document.getElementById('navbar').innerHTML = navbarHtml;
    } catch (error) {
        console.error('Error fetching navbar:', error);
    }
}

async function fetchinfo() {
    await fetchNavbar();
}

fetchinfo();