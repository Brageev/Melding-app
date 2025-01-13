




fetchMessages();
   
console.log('hello world');


async function fetchMessages() {

    try {
        let response = await fetch('/getmessages/');
        let data = await response.json();

        for (let i = 0; i < data.length; i++) {
            console.log(data[i], "data[i]");
        }
        showMessages(data);

    } catch (error) {
        console.error('Error:', error);
    }
}


function showMessages(messages) {
    
    const messageContainer = document.getElementById('chat-messages');
    messageContainer.innerHTML = '';
    console.log(messages, 'rooms')
    console.log(messages.length, 'rooms length')
    messages.forEach((message) => {
        messageContainer.innerHTML += `<div class="message gray-bg">
        <div class="message-sender">${message.username}</div>
        <div class="message-text">${message.content}</div>
        <div class="message-timestamp">${message.time}</div> 
        
    </div>`;

    });
    
}
