const sqlite3 = require('better-sqlite3')
const db = sqlite3('./database.db', {verbose: console.log})
const path = require('path')
const express = require('express')
const app = express()
const session = require('express-session')
const PORT = process.env.PORT || 3000
const bcrypt = require('bcrypt')
const staticPath = path.join(__dirname, 'public');
const viewsPath = path.join(__dirname, 'views');
app.set('views', viewsPath);
app.use(express.urlencoded({ extended: true })); 
app.use(express.json()); 
const saltRounds = 10;
const { RateLimiterMemory } = require('rate-limiter-flexible');

const rateLimiter = new RateLimiterMemory(
    {
      points: 5, // 5 points
      duration: 3, // per second
    });


setInterval(() => {
    const sql = db.prepare('DELETE FROM messages WHERE time < datetime(\'now\', \'-1 hour\')');
    sql.run();
}, 1000 * 60 * 60);


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
app.get('/createpost/', checkLoggedIn, (_, res) => {
        console.log('createpost')
        res.sendFile(path.join(staticPath, '/createpost/index.html'));
    });
app.get('/getposts/', checkLoggedIn, (_, resp) => {
    const sql = db.prepare('SELECT posts.id, posts.userId, posts.content, posts.time, users.username as username ' + 
        'FROM posts ' +
        'INNER JOIN users ON posts.userId = users.id');
    let posts = sql.all().map(post => ({
        id: post.id,
        sender: post.username,
        text: post.content,
        timestamp: post.time
    }));
    resp.send(posts);
});

app.set('view engine', 'ejs');

app.get('/posts/', checkLoggedIn, (_, res) => {
    const sql = db.prepare('SELECT posts.id, posts.userId, posts.content, posts.time, users.username as username ' + 
        'FROM posts ' +
        'INNER JOIN users ON posts.userId = users.id');
    let posts = sql.all().map(post => ({
        id: post.id,
        sender: post.username,
        text: post.content,
        timestamp: post.time
    }));
    res.render('posts', { posts });
    
});


app.get('/post/:id', checkLoggedIn, (req, res) => {
    const postId = parseInt(req.params.id);
    const sql = db.prepare('SELECT posts.id, posts.userId, posts.content, posts.time, users.username as username ' + 
        'FROM posts ' +
        'INNER JOIN users ON posts.userId = users.id ' +
        'WHERE posts.id = ?');
    let post = sql.get(postId);
    let postDetails = {
        id: postId,
        sender: post.username,
        content: post.content,
        time: post.time
    };
    res.render('post', { post: postDetails });
});
//h


app.get('/groupchat/:id', checkLoggedIn, (req, res) => {
    const groupchatId = parseInt(req.params.id);
    console.log("groupchatId", groupchatId);
    const userId = req.session.user.id; 

    const membershipSql = `SELECT COUNT(*) AS count FROM group_members WHERE group_id = ? AND user_id = ?`;

    try {
        const row = db.prepare(membershipSql).get(groupchatId, userId);
        if (row.count === 0) {
            return res.status(403).send("Forbidden: You are not a member of this group.");
        }

        const groupchat = db.prepare('SELECT * FROM groups WHERE id = ?').get(groupchatId);
        if (!groupchat) {
            return res.status(404).send("Group chat not found");
        }

        let groupchatDetails = {
            id: groupchat.id,
            name: groupchat.name,
        };

        res.render('groupchat', { groupchat: groupchatDetails });
    } catch (err) {
        console.error("Database error:", err);
        return res.status(500).send("Internal Server Error");
    }
});





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

function checkLoggedIn(req, res, next) {
    if (req.session.loggedIn) {
        return next();
    } else {
        res.redirect('/login');
    }
}

function addMessage(userId, content, time) {
    
    str = escape_html(content);
    console.log("THE THINGS: ", userId, str, time);
    sql = db.prepare("INSERT INTO messages (userId, content, time) " +
                         "values (?, ?, ?)");
                         
    const info = sql.run(userId, str, time)
    
    sql = db.prepare('SELECT messages.id, messages.userId, messages.content, messages.time, users.username as username ' + 
        'FROM messages ' +
        'INNER JOIN users ON messages.userId = users.id ' +
        'WHERE messages.id = ?');
    let rows = sql.all(info.lastInsertRowid)  

    return rows[0]
};

function addPost(userId, content, time) {
    const sql = db.prepare("INSERT INTO posts (userId, content, time) " +
                         "values (?, ?, ?)");
    const info = sql.run(userId, content, time);
    const row = db.prepare('SELECT * FROM posts WHERE id = ?').get(info.lastInsertRowid);
    console.log('row inserted', row);
    return row;
}

app.get('/getmessages/', checkLoggedIn, (req, resp) => {
    console.log('/getmessages/')

    const page = parseInt(req.query.page) || 1;
    const pageSize = parseInt(req.query.pageSize) || 10;
    const offset = (page - 1) * pageSize;

    const sql = db.prepare('SELECT messages.id, messages.userId, messages.content, messages.time, users.username as username ' + 
        'FROM messages ' +
        'INNER JOIN users ON messages.userId = users.id ' +
        'ORDER BY messages.id DESC ' + 
        'LIMIT ? OFFSET ?');
    let messages = sql.all(pageSize, offset);
    resp.send(messages);
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


app.post('/createpost', async (req, res) => {
    const { content } = req.body;
    const user = req.session.user;
    console.log('user real:', req.session.user);
    const time = Date.now();
    console.log('Received post:', content);
    addPost(user.id, content, time);
    res.redirect('/posts/');
}
);





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
        <li class='navbarli'><a href="/createpost/">New post</a></li>
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
    
    socket.on('message', async (data) => {
        try {
            
            await rateLimiter.consume(socket.id);
            str = escape_html(data);

            console.log('Received message:', str);
            
            const time = Date.now();
            console.log('Time:', Date.now());
            console.log('Time:', time);
            const messageAdd = addMessage(session.user.id, data, time);
            const messageSend = {
                id: messageAdd.id,
                userId: messageAdd.userId,
                username: session.user.username,
                content: messageAdd.content,
                time: messageAdd.time
            };
            socket.broadcast.emit('chat-message', messageSend);
        } catch (rejRes) {
            console.log("Rate limit reached");
            socket.emit('rate-limit', { message: 'You are sending messages too fast. Please slow down.' });
            return;
        }
    });
}
