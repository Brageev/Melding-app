const socket = io();
const clientsTotal = document.getElementById('client-total')
const messageContainer = document.getElementById('chat-messages');
const messageForm = document.getElementById('message-input');
const messageInput = document.getElementById('content');
const userInfo = document.getElementById('user-info');
messageContainer.innerHTML = '';
const userData = {};
fetchUser();

messageForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const message = messageInput.value;
    const time = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false });
    socket.emit('message', message, time);
    messageInput.value = '';
    showMessages(
        [{
            username: userData.username,
            content: message,
            time: time
        }]
    );
})

socket.on('chat-message', (data) => {
    console.log('Received message:', data);
    showMessages([data]);
  })
  
socket.on('info', (data) => {
    console.log('clients-total', data);
    username = data;
})

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



async function fetchMessages(messageContainer) {
    try {
        let response = await fetch('/getmessages/');
        let data = await response.json();
        console.log(data);
        
        showMessages(data, messageContainer);
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

function showMessages(messages) {
    messages.forEach((message) => {
        if (message.username === userData.username) {
            messageContainer.innerHTML += `<div class="message blue-bg">
            <div class="message-sender">${message.username}</div>
            <div class="message-text">${message.content}</div>
            <div class="message-timestamp">${message.time}</div>
            </div>`;
        } 
        else {
            messageContainer.innerHTML += `<div class="message gray-bg">
            <div class="message-sender">${message.username}</div>
            <div class="message-text">${message.content}</div>
            <div class="message-timestamp">${message.time}</div> 
            </div>`;
        }
    messageContainer.scrollTop = messageContainer.scrollHeight

    });
    
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
fetchMessages(messageContainer);
