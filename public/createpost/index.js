const postInput = document.getElementById('content');
const socket = io();


document.getElementById('post-input-form').addEventListener('submit', function(event) {
    event.preventDefault();
    const post = postInput.value;
    socket.emit('post', post);
    postInput.value = '';
    const time = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false });

   
    })






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