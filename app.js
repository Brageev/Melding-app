const sql = require('mssql');

const config = {
    user: 'Brage',
    password: 'Passord01',
    server: 'meldingappserver.database.windows.net',
    database: 'meldingDB',
    options: {
        encrypt: true,
        enableArithAbort: true
    }
};

async function connectDB() {
    try {
        await sql.connect(config);
        console.log("Connected to Azure SQL Database");
    } catch (err) {
        console.error("Database connection failed: ", err);
    }
}

connectDB();

const path = require('path')
const express = require('express')
const app = express()
const session = require('express-session')
const PORT = process.env.PORT || 443
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

setInterval(async () => {
    try {
        await sql.query`DELETE FROM messages WHERE timeSendt < DATEADD(hour, -1, GETDATE())`;
    } catch (err) {
        console.error("Failed to delete old messages: ", err);
    }
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
app.get('/getposts/', checkLoggedIn, async (_, resp) => {
    try {
        const result = await sql.query`SELECT posts.id, posts.userId, posts.content, posts.timeSendt, users.username as username 
                                       FROM posts 
                                       INNER JOIN users ON posts.userId = users.id`;
        let posts = result.recordset.map(post => ({
            id: post.id,
            sender: post.username,
            text: post.content,
            timestamp: post.timeSendt
        }));
        resp.send(posts);
    } catch (err) {
        console.error("Failed to get posts: ", err);
        resp.status(500).send("Failed to get posts");
    }
});

app.set('view engine', 'ejs');

app.get('/posts/', checkLoggedIn, async (_, res) => {
    try {
        const result = await sql.query`SELECT posts.id, posts.userId, posts.content, posts.timeSendt, users.username as username 
                                       FROM posts 
                                       INNER JOIN users ON posts.userId = users.id`;
        let posts = result.recordset.map(post => ({
            id: post.id,
            sender: post.username,
            text: post.content,
            timestamp: post.timeSendt
        }));
        res.render('posts', { posts });
    } catch (err) {
        console.error("Failed to get posts: ", err);
        res.status(500).send("Failed to get posts");
    }
});

app.get('/post/:id', checkLoggedIn, async (req, res) => {
    const postId = parseInt(req.params.id);
    try {
        const result = await sql.query`SELECT posts.id, posts.userId, posts.content, posts.timeSendt, users.username as username 
                                       FROM posts 
                                       INNER JOIN users ON posts.userId = users.id 
                                       WHERE posts.id = ${postId}`;
        let post = result.recordset[0];
        let postDetails = {
            id: postId,
            sender: post.username,
            content: post.content,
            timeSendt: post.timeSendt
        };
        res.render('post', { post: postDetails });
    } catch (err) {
        console.error("Failed to get post: ", err);
        res.status(500).send("Failed to get post");
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

async function addMessage(userId, content, timeSendt) {
    const str = escape_html(content);
    try {
        const result = await sql.query`INSERT INTO messages (userId, content, timeSendt) 
                                       OUTPUT INSERTED.*
                                       VALUES (${userId}, ${str}, ${timeSendt})`;
        return result.recordset[0];
    } catch (err) {
        console.error("Failed to add message: ", err);
        return null;
    }
}

async function addPost(userId, content, timeSendt) {
    try {
        const result = await sql.query`INSERT INTO posts (userId, content, timeSendt) 
                                       OUTPUT INSERTED.*
                                       VALUES (${userId}, ${content}, ${timeSendt})`;
        console.log('row inserted', result.recordset[0]);
        return result.recordset[0];
    } catch (err) {
        console.error("Failed to add post: ", err);
        return null;
    }
}

app.get('/getmessages/', checkLoggedIn, async (req, resp) => {
    console.log('/getmessages/')

    const page = parseInt(req.query.page) || 1;
    const pageSize = parseInt(req.query.pageSize) || 10;
    const offset = (page - 1) * pageSize;

    try {
        const result = await sql.query`SELECT messages.id, messages.userId, messages.content, messages.timeSendt, users.username as username 
                                       FROM messages 
                                       INNER JOIN users ON messages.userId = users.id 
                                       ORDER BY messages.id DESC 
                                       OFFSET ${offset} ROWS 
                                       FETCH NEXT ${pageSize} ROWS ONLY`;
        resp.send(result.recordset);
    } catch (err) {
        console.error("Failed to get messages: ", err);
        resp.status(500).send("Failed to get messages");
    }
});

app.get('/getuser/', checkLoggedIn, (req, resp) => {
    console.log('/getuser/')
    resp.send(req.session.user)
});

app.post('/adduser', async (req, res) => {
    const { username, email, password } = req.body;
    // Validate email format and check if email already exists
    if (!checkEmailregex(email)) {
        return res.json({ error: 'Invalid email format.' });
    } else if (await checkEmailExists(email)) {
        return res.json({ error: 'Email already exists.' });
    } else {
        // Insert new user
        const newUser = await addUser(username, email, password);

        if (!newUser) {
            return res.json({ error: 'Failed to register user.' });
        }
        res.redirect('/chat/');
    }
});

async function addUser(username, email, password) {
    const hashedPassword = bcrypt.hashSync(password, saltRounds);
    try {
        const result = await sql.query`INSERT INTO users (username, email, password) 
                                       OUTPUT INSERTED.*
                                       VALUES (${username}, ${email}, ${hashedPassword})`;
        console.log('row inserted', result.recordset[0]);
        return result.recordset[0];
    } catch (err) {
        console.error("Failed to add user: ", err);
        return null;
    }
}

function checkEmailregex(email) {
    const emailRegex = /^[^\s@\.][^\s@]*@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
}

async function checkEmailExists(email) {
    try {
        const result = await sql.query`SELECT COUNT(*) as count FROM users WHERE email = ${email}`;
        console.log("result.count", result.recordset[0].count);
        return result.recordset[0].count > 0;
    } catch (err) {
        console.error("Failed to check email existence: ", err);
        return false;
    }
}

app.post('/createpost', async (req, res) => {
    const { content } = req.body;
    const user = req.session.user;
    console.log('user real:', req.session.user);
    const time = Date.now();
    console.log('Received post:', content);
    await addPost(user.id, content, time);
    res.redirect('/posts/');
});

app.post('/login', async (req, res) => {
    const { email, password } = req.body;
    
    try {
        const result = await sql.query`SELECT * FROM users WHERE email = ${email}`;
        const user = result.recordset[0];
        
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
            } else {
                res.redirect('/chat/');
            }
            console.log("user " + user)
            console.log(req.session)
        } else {
            return res.status(401).send('Ugyldig email eller passord');
        }
    } catch (err) {
        console.error("Failed to login: ", err);
        res.status(500).send("Failed to login");
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
            const str = escape_html(data);

            console.log('Received message:', str);
            
            const time = Date.now();
            console.log('Time:', Date.now());
            console.log('Time:', time);
            const messageAdd = await addMessage(session.user.id, data, time);
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
