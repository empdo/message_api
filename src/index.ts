import express, { response } from 'express';
import mariadb from 'mariadb';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcrypt';
import cors from 'cors';
import dotenv from 'dotenv';

dotenv.config();

import { Config } from './interfaces';

const config: Config = {
    jwtSecret: process.env.JWT_SECRET || "",
    host: process.env.HOST || "127.0.0.1",
    mariadb: {
        host: process.env.MARIADB_HOST || "127.0.0.1",
        user: process.env.MARIADB_USER || "",
        password: process.env.MARIADB_PASSWORD || "",
        database: process.env.MARIADB_DATABASE || "",
        port: parseInt(process.env.MARIADB_PORT || "3306"),
    },
    port: parseInt(process.env.PORT || "4678")
};

// Validate that config was created correctly using a loop
for (const key in config) {
    if (!config[key]) {
        console.error(`Missing config for ${key}`);
        process.exit(1);
    }
}

const pool = mariadb.createPool({
    ...config.mariadb,
    connectionLimit: 5,
});

var app = express();
app.use(express.json());
app.use(cors());

const getTableData = async (conn: mariadb.PoolConnection, table: string) => {
    const res = await conn.query(`select * from ${table};`)

    return res;

}

const sendMessage = async (conn: mariadb.PoolConnection, content: string, sender: number, reciver: number,) => {
    return conn.query("INSERT INTO messages (content, sender, receiver, date) VALUES (?, ?, ?, ?);", [content, sender, reciver, Math.round(Date.now() / 1000)]);
}

const createUser = async (conn: mariadb.PoolConnection, name: string, password: string) => {

    const passwordHash = await bcrypt.hash(password, 10);

    const getResponse = await conn.query("SELECT * FROM users WHERE name = ?;", [name]);

    if(!getResponse[0]) {
        const insertResponse = await conn.query("INSERT INTO users (name, password) VALUES (?, ?)", [name, passwordHash]);

        return createToken(name, insertResponse.insertId);
    }


    return null;

}

const getUser = async (conn: mariadb.PoolConnection, id: number) => {

    const user = await conn.query("SELECT * FROM users WHERE id = ?;", [id]);

    if(user[0]) {
        return user[0].name;
    }

    return null;
}

const getReqUserId = async (conn: mariadb.PoolConnection, req: { headers: { authorization?: string | undefined } }) => {
    const [type, token] = req.headers["authorization"]?.split(" ") || [null, null];

    if (type === "Bearer" && token) {

        try {
            jwt.verify(token, config.jwtSecret);
        } catch (err) {
            return null;
        }

        const decodedJwt = jwt.decode(token, { json: true });


        if (decodedJwt && decodedJwt.sub) {
            const user = parseInt(decodedJwt.sub);

            if(!(await getUser(conn, parseInt(decodedJwt.sub)))) return null;

            return user;
        }
    }

    return null;
}

const getConversation = async (conn: mariadb.PoolConnection, userId: number, conversationId: number) => {
    const informationResponse = await conn.query("SELECT * FROM messages WHERE (receiver = ? and sender = ?) or (sender = ? and receiver = ?);", [userId, conversationId, userId, conversationId])

    return informationResponse;
}

const getConversations = async (conn: mariadb.PoolConnection, id: number) => {
    const messages = await conn.query("SELECT * FROM messages WHERE receiver = ? or sender = ?", [id, id]);

    const conversations: {id: number, name: string}[]  = [];

    for (const message of messages) {
        const realId = message.sender === id ? message.receiver : message.sender;

        if (!conversations.some(conversation => conversation.id === realId)) {
            conversations.push({id : realId, name : await getUser(conn, realId)});
        }
    }

    return conversations;
}


const createToken = (name: string, id: number) => {
    return jwt.sign({ "sub": id, "name": name, "iat": Math.round(Date.now() / 1000) }, config.jwtSecret);
}

const getToken = async (conn: mariadb.PoolConnection, name: string, password: string) => {

    const informationResponse = await conn.query("select * from users where name=?;", [name]);

    if (informationResponse.length == 0 || !(await bcrypt.compare(password, (informationResponse[0]).password.toString()))) {
        return null;
    }

    return createToken(name, informationResponse[0].id);
}

pool.getConnection()
    .then(conn => {

        conn.query(`CREATE TABLE IF NOT EXISTS users (
            id int(11) NOT NULL AUTO_INCREMENT,
            name varchar(255) NOT NULL,
            password binary(60) NOT NULL,
            PRIMARY KEY (id)
          )`);

        conn.query(`CREATE TABLE IF NOT EXISTS messages (
            id int(11) NOT NULL AUTO_INCREMENT,
            content text NOT NULL,
            sender int(11) NOT NULL,
            receiver int(11) NOT NULL,
            date int(11) DEFAULT NULL,
            PRIMARY KEY (id),
            KEY receiver (receiver),
            CONSTRAINT messages_ibfk_1 FOREIGN KEY (receiver) REFERENCES users (id)
          )`);

        app.post("/user", async (req, res) => {
            const { name, password } = req.body;

            const createUserRespons = await createUser(conn, name, password);

            if (createUserRespons != null) {
                res.send(createUserRespons);
            } else {
                res.sendStatus(401);
            }


        });

        app.post("/auth", async (req, res) => {
            const { name, password } = req.body;

            if (name && password) {
                const data = { token: await getToken(conn, name, password) }
                res.send(data);
            } else {
                res.sendStatus(401);
            }

        });

        app.get("/users", async (req, res) => {
            const users = await getTableData(conn, "users");

            res.send(users);
        });

        app.get("/conversation/:id", async (req, res) => {
            const auth = req.headers["authorization"];
            const id = parseInt(req.params.id);

            const userId = await getReqUserId(conn, req);

            if (!userId || !id) {
                res.sendStatus(401);
                return;
            }

            const conversation = await getConversation(conn, userId, id);

            res.send({messages: conversation, name: await getUser(conn, id)});
        });

        app.get("/conversations", async (req, res) => {
            const userId = await getReqUserId(conn, req);

            if (!userId) {
                res.sendStatus(401);
                return;
            }


            const conversation = await getConversations(conn, userId);
            res.send(conversation);
        });


        app.post("/send", async (req, res) => {
            const { content, reciver } = req.body;
            const userId = await getReqUserId(conn,req);

            if (!userId) {
                res.sendStatus(401);
                return;
            }

            const messageRresponse = await sendMessage(conn, content, userId, reciver);
            res.send(messageRresponse);

        });

        app.listen(config.port, config.host, () =>{
            console.log(`Example app listening on port ${config.port}!`);
            console.log("started"); }
        );

    });