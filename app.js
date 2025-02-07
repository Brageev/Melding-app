const sqlite3 = require('better-sqlite3')
const db = sqlite3('./database.db', {verbose: console.log})
const path = require('path')
const express = require('express')
const app = express()
const session = require('express-session')
const bcrypt = require('bcrypt');
const saltRounds = 10;
const PORT = process.env.PORT || 3000
const staticPath = path.join(__dirname, 'public');
app.use(express.urlencoded({ extended: true })); 
app.use(express.json()); 


sessionMiddleware = session({
    secret: 'hemmelig_nøkkel',
    resave: false,
    loggedIn: false,
    saveUninitialized: true,
    cookie: { secure: false },
});
app.use(sessionMiddleware);

app.get('/', checkLoggedIn, (_, res) => {
        res.sendFile(path.join(staticPath, '/home/index.html'));
    });
app.get('/chat/', checkLoggedIn, (_, res) => {
        console.log('chat')
        res.sendFile(path.join(staticPath, '/chat/index.html'));
    });
app.get('/posts/', checkLoggedIn, (_, res) => {
        res.sendFile(path.join(staticPath, '/posts/index.html'));
    });
    
function checkLoggedIn(req, res, next) {
    if (req.session.loggedIn) {
        console.log('Bruker logget inn:', req.session.user);
        return next();
    } else {
        console.log('Bruker ikke logget inn');
        res.redirect('/login');
    }
}

function addMessage(userId, content, time) {
    console.log("THE THINGS: ", userId, content, time);
    sql = db.prepare("INSERT INTO messages (userId, content, time) " +
                         "values (?, ?, ?)");
    const info = sql.run(userId, content, time)
    
    sql = db.prepare('SELECT messages.id, messages.userId, messages.content, messages.time, users.username as username ' + 
        'FROM messages ' +
        'INNER JOIN users ON messages.userId = users.id ' +
        'WHERE messages.id = ?');
    let rows = sql.all(info.lastInsertRowid)  

    return rows[0]
};

app.get('/getmessages/', checkLoggedIn,  (_, resp) => {
    console.log('/getmessages/')

    const sql = db.prepare('SELECT messages.id, messages.id, messages.userId, messages.content, messages.time, users.username as username ' + 
        'FROM messages ' +
        'INNER JOIN users ON messages.userId = users.id');
    let messages = sql.all()
    resp.send(messages)
});

app.get('/getuser/', checkLoggedIn,  (req, resp) => {
    console.log('/getuser/')
    resp.send(req.session.user)
});


app.post('/adduser', (req, res) => {
    const { username, email, password } = req.body;
    // Validate email format and check if email already exists
    if (!checkEmailregex(email)) {
        return res.json({ error: 'Invalid email format.' });
    } else if (checkEmailExists(email)) {
        return res.json({ error: 'Email already exists.' });
    } else {
        // Insert new user
        const newUser = addUser(username, email, password);

        if (!newUser) {
            return res.json({ error: 'Failed to register user.' });
        }
        res.redirect('/chat/');
    }
});
function addUser(username, email, password) {

    password = bcrypt.hashSync(password, saltRounds);

    const sql = db.prepare("INSERT INTO users (username, email, password) " +
                         "values (?, ?, ?)");
    const info = sql.run(username, email, password);
    const row = db.prepare('SELECT * FROM users WHERE id = ?').get(info.lastInsertRowid);
    console.log('row inserted', row);
    return row;
}
function checkEmailregex(email) {
    const emailRegex = /^[^\s@\.][^\s@]*@[^\s@]+\.[^\s@]+$/;
    let result = emailRegex.test(email);
 
    if (!result) {
        return false;
    }
    return true;


}
function checkEmailExists(email) {

    let sql = db.prepare("select count(*) as count from users where email = ?")
    let result = sql.get(email);
    console.log("result.count", result)
    if (result.count > 0) {
        console.log("Email already exists")
        return true;
    }
    return false;

}
app.post('/login', async (req, res) => {
    const { email, password } = req.body;
    
    const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email);
    
    if (!user) {
        return res.status(401).send('Ugyldig email eller passord');
    }
   
    // Sjekk om passordet samsvarer med hash'en i databasen
    const isMatch = await bcrypt.compare(password, user.password);
    user.password = undefined;
    if (isMatch) {
        // Lagre innloggingsstatus i session
        req.session.loggedIn = true;
        req.session.email = user.email;
        req.session.user = user;

        //DETTE REDIRECTER TIL APP INDEX.HTML
        if (user.isAdmin == 1) {
            res.redirect('/chat/');
        } 
        
        else {
            res.redirect('/chat/');

        }
        console.log("user " + user)
        console.log(req.session)
    } else {
        return res.status(401).send('Ugyldig email eller passord');
    }
});

app.use((req, res, next) => {
    res.locals.navbar = `
        <li class='navbarli'><a href="/home/">Home</a></li>
        <li class='navbarli'><a href="/chat/">Chat</a></li>
        <li class='navbarli'><a href="/posts/">Posts</a></li>
        <li class='navbarli'><a href="/historikk/">New post</a></li>
        ${req.session.loggedIn && req.session.user.isAdmin ? '<li><a href="/admin/">Admin</a></li>' : ''}
    `;
    next();
});

app.get('/navbar', (req, res) => {
    res.send(res.locals.navbar);
});





app.use(express.static(staticPath));
const server = app.listen(PORT, () => console.log(`http://localhost:${PORT}`))


const io = require('socket.io')(server)
let socketsConnected = new Set();
io.on('connection', onConnection); 
io.engine.use(sessionMiddleware);

function onConnection(socket) {
    const session = socket.request.session;
    
    if (!session || !session.loggedIn) {
        return;
    }

    socket.on('disconnect', function() {
        console.log('Client disconnected');
        socketsConnected.delete(socket.id);
    });

    const sessionId = socket.request.session.id;
    socket.join(sessionId);
    console.log('Client connected', socket.id);
    socketsConnected.add(socket.id);
    console.log('Number of clients connected:', socketsConnected.size);
    console.log('user:', session.user); 

    //får melding fra klient og sender videre til alle klienter
    socket.on('message', (data, time) => {
        console.log('Received message:', data);
        
        const messageAdd = addMessage(session.user.id, data, time);
        const messageSend = {
            id: messageAdd.id,
            userId: messageAdd.userId,
            username: session.user.username,
            content: messageAdd.content,
            time: messageAdd.time
        }
        socket.broadcast.emit('chat-message', messageSend);
    });
}
