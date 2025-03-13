const socket = io();
const clientsTotal = document.getElementById('client-total');
const messageContainer = document.getElementById('chat-messages');
const messageForm = document.getElementById('message-input');
const messageInput = document.getElementById('content');
const userInfo = document.getElementById('user-info');
messageContainer.innerHTML = '';
const userData = {};
let isLoading = false;
let page = 1;
const pageSize = 20;


messageForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const message = messageInput.value;
    socket.emit('message', message);
    messageInput.value = '';
    const time = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false });

    showMessages(
        [{
            username: userData.username,
            content: message,
            time: time
        }]
    );
});

messageContainer.addEventListener('scroll', async () => {
    if (messageContainer.scrollTop === 0 && !isLoading) {
        isLoading = true;
        page++;
        await fetchMessages(messageContainer, page, pageSize);
        isLoading = false;
    }
});

socket.on('rate-limit', (data) => {   
    console.log('Received message:', data);
    const alertBox = document.createElement('div');
    alertBox.style.position = 'fixed';
    alertBox.style.top = '50%';
    alertBox.style.left = '50%';
    alertBox.style.transform = 'translate(-50%, -50%)';
    alertBox.style.padding = '20px';
    alertBox.style.backgroundColor = 'white';
    alertBox.style.border = '2px solid black';
    alertBox.style.zIndex = '1000';
    alertBox.innerHTML = `<p>${data.message}</p>`;
    document.body.appendChild(alertBox);
    messageInput.disabled = true;
    messageForm.querySelector('button').disabled = true;
    setTimeout(() => {
        document.body.removeChild(alertBox);
        // Re-enable the message input form
        messageInput.disabled = false;
        messageForm.querySelector('button').disabled = false;
    }, 5000);
});

socket.on('chat-message', (data) => {
    console.log('Received message:', data);
    showMessages([data]);            
});

socket.on('info', (data) => {
    console.log('clients-total', data);
    username = data;
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
async function fetchMessages(messageContainer, page = 0, pageSize = 20) {
    try {
        let response = await fetch(`/getmessages/?page=${page}&pageSize=${pageSize}`);
        let data = await response.json();
        console.log(data);

    

        const currentScrollHeight = messageContainer.scrollHeight;
        const currentScrollTop = messageContainer.scrollTop;

        const fragment = document.createDocumentFragment();
        data.reverse().forEach((message) => {
            const messageElement = document.createElement('div');
            messageElement.classList.add('message');
            messageElement.classList.add(message.username === userData.username ? 'blue-bg' : 'gray-bg');
            messageElement.innerHTML = `
                <div class="message-sender">${message.username}</div>
                <div class="message-text">${message.content}</div>
                <div class="message-timestamp">${message.time}</div>
            `;
            fragment.appendChild(messageElement);
        });
        messageContainer.insertBefore(fragment, messageContainer.firstChild);


        messageContainer.scrollTop = messageContainer.scrollHeight - currentScrollHeight + currentScrollTop;

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
    const fragment = document.createDocumentFragment();
    messages.forEach((message) => {
        const messageElement = document.createElement('div');
        messageElement.classList.add('message');
        messageElement.classList.add(message.username === userData.username ? 'blue-bg' : 'gray-bg');
        messageElement.innerHTML = `

            <div class="message-sender">${message.username}</div>
            <div class="message-text">${message.content}</div>
            <div class="message-timestamp">${message.time}</div>
        `;
        fragment.appendChild(messageElement);
    });
    messageContainer.appendChild(fragment);
    messageContainer.scrollTop = messageContainer.scrollHeight;
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

async function fetchinfo() {
    await fetchUser();
    await fetchNavbar();
    await fetchMessages(messageContainer, page, pageSize);
}

fetchinfo();