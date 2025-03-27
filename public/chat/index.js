const socket = io();
const clientsTotal = document.getElementById('client-total');
const messageContainer = document.getElementById('chat-messages');
const messageForm = document.getElementById('chat-input-form');
const messageInput = document.getElementById('content');
const userInfo = document.getElementById('user-info');
messageContainer.innerHTML = '';
const userData = {};
let isLoading = false;
let page = 1;
const pageSize = 20;
function escape_html(content) {
    return content.replace(/[&<>"'\/]/g, (char) => {
        switch (char) {
        case '&':
            return '&amp;';
        case '<':
            return '&lt;';
        case '>':
            return '&gt;';
        case '"':
            return '&quot;';
        case '\\':
            return '&#39;';
        case '/':
            return '&#x2F;';
        default:
            return char;
        }
    });
}

messageForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const message = messageInput.value;
    const str = escape_html(message);
    socket.emit('message', message);
    messageInput.value = '';
    const timeSendt = new Date();

    showMessages(
        [{
            username: userData.username,
            content: str,
            timeSendt: timeSendt
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
        const currentScrollHeight = messageContainer.scrollHeight;
        const currentScrollTop = messageContainer.scrollTop;

        const fragment = document.createDocumentFragment();
        data.reverse().forEach((message) => {
            const messageElement = document.createElement('div');
            const messageTime = new Date(parseInt(message.timeSendt)).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false });
            messageElement.classList.add('message');
            messageElement.classList.add(message.username === userData.username ? 'blue-bg' : 'gray-bg');
            messageElement.innerHTML = `
                <div class="message-sender">${message.username}</div>
                <div class="message-text">${message.content}</div>
                <div class="message-timestamp">${messageTime}</div>
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
    const currentScrollHeight = messageContainer.scrollHeight;
    const currentScrollTop = messageContainer.scrollTop;
    messages.forEach((message) => {
        console.log(message);
        const messageTime = new Date(message.timeSendt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false });
        const messageElement = document.createElement('div');
        messageElement.classList.add('message');
        messageElement.classList.add(message.username === userData.username ? 'blue-bg' : 'gray-bg');
        messageElement.innerHTML = `
            <div class="message-sender">${message.username}</div>
            <div class="message-text">${message.content}</div>
            <div class="message-timestamp">${messageTime}</div>
        `;
        fragment.appendChild(messageElement);
    });
    messageContainer.appendChild(fragment);
    messageContainer.scrollTop = messageContainer.scrollHeight - currentScrollHeight + currentScrollTop;
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