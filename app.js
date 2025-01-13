const sqlite3 = require('better-sqlite3')
const path = require('path')
const db = sqlite3('./database.db', {verbose: console.log})
const express = require('express')
const app = express()
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
const staticPath = path.join(__dirname, 'public')
const session = require('express-session')
const bcrypt = require('bcrypt');
const saltRounds = 10;

app.get('/', checkLoggedIn, (_, res) => {
    res.redirect('/login/')
});

//messages
app.use(session({
    secret: 'hemmelig_nøkkel',
    resave: false,
    saveUninitialized: true,
    cookie: { secure: false } // Sett til true hvis du bruker HTTPS
}));
function checkLoggedIn(req, res, next) {
    if (req.session.loggedIn) {
        console.log('Bruker logget inn:', req.session.user);
        return next();
    } else {
        res.redirect('/login/');
    }
}


app.post('/sendmessage', (req, res) => {
    const { content } = req.body;
    console.log('Message:', content);
    // const date = new Date();
  
    const newActivity = addMessage(1, content, "time");

    if (!newActivity) {
        return res.json({ error: 'Failed to register activity.' });
    }
    
    res.redirect('./home/index.html')

});
function addMessage(userId, content, time, ) {

    console.log("THE THINGS: ", userId, content, time);
    sql = db.prepare("INSERT INTO messages (userId, content, time) " +
                         "values (?, ?, ?)");
    const info = sql.run(userId, content, time)
    
    sql = db.prepare('SELECT messages.id, messages.userId, messages.content, messages.time, users.username as username ' + 
        'FROM messages ' +
        'INNER JOIN users ON messages.userId = users.id ' +
        'WHERE messages.id = ?');
    let rows = sql.all(info.lastInsertRowid)  
    console.log('row inserted', rows[0])

    return rows[0]
};
app.get('/getmessages/', checkLoggedIn,  (_, resp) => {
    console.log('/getmessages/')

    const sql = db.prepare('SELECT messages.id, messages.id, messages.userId, messages.content, messages.time, users.username as username ' + 
        'FROM messages ' +
        'INNER JOIN users ON messages.userId = users.id');
    let messages = sql.all()   
    
    console.log("messages", messages)
    
    resp.send(messages)
});



//Register user

app.post('/adduser', (req, res) => {
    const { username, email, password } = req.body;
    // Validate email format and check if email already exists
    if (!checkEmailregex(email)) {
        return res.json({ error: 'Invalid email format.' });
    } else if (!checkEmailExists(email)) {
        res.redirect('home/index.html?errorMsg=EmailExist');
    } else {
        // Insert new user
        const newUser = addUser(username, email, password);

        if (!newUser) {
            return res.json({ error: 'Failed to register user.' });
        }
        
        res.redirect('/app/');
    }
});
function addUser(username, email, password)
 {

    password = bcrypt.hashSync(password, saltRounds);

    sql = db.prepare("INSERT INTO users (username, email, password) " +
                         "values (?, ?, ?)")
    const info = sql.run(username, email, password)
    
    sql = db.prepare('SELECT users.id as userId, username, username, password ' + 
        'WHERE users.id  = ?');
    let rows = sql.all(info.lastInsertRowid)  
    console.log('row inserted', rows[0])

    return rows[0]
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
        return false;
    }
    return true;

}




app.post('/login', async (req, res) => {
    const { email, password } = req.body;
    
    // Finn brukeren basert på brukernavn
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
            res.redirect('/admin/index.html');
        } else {
            res.redirect('/app/index.html');
        }
        console.log("user " + user)
    } else {
        return res.status(401).send('Ugyldig email eller passord');
    }
});

















app.use(express.static(staticPath));
app.listen(3000, () => {
    console.log('Server is running on http://localhost:3000');
})
