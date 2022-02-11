import express, { response } from 'express';
import mariadb from 'mariadb';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcrypt';
import secrets from "./secrets.json";
import cors from 'cors';

import { Conversation } from './interfaces';


const pool = mariadb.createPool({
    host: '192.168.0.153',
    user: 'emil',
    password: secrets.mariadbPassword,
    database: 'message_app',
    connectionLimit: 5
});

var app = express();
app.use(express.json());
app.use(cors());
const port = parseInt(process.env.SERVER_PORT) || 4789;

const getTableData = async (conn: mariadb.PoolConnection, table: string) => {
    const res = await conn.query(`select * from ${table};`)

    return res;

}

const getId = (token: string) => {
    const user = jwt.decode(token);

    return user?.sub;
}

const sendMessage = async (conn: mariadb.PoolConnection, content: string, sender: number, reciver: number,) => {
    return conn.query("INSERT INTO messages (content, sender, receiver, date) VALUES (?, ?, ?, ?);", [content, sender, reciver, Math.round(Date.now() / 1000)]);
}

const createUser = async (conn: mariadb.PoolConnection, name: string, password: string) => {

    const passwordHash = await bcrypt.hash(password, 10);

    const insertResponse = await conn.query("INSERT INTO users (name, password) VALUES (?, ?);", [name, passwordHash]);


    return createToken(name, insertResponse.insertId);

}

const getUser = async (conn: mariadb.PoolConnection, id: number) => {

    const user = await conn.query("SELECT * FROM users WHERE id = ?;", [id]);

    return user[0].name;
}

const getReqUserId = (req: { headers: { authorization?: string | undefined } }) => {
    const [type, token] = req.headers["authorization"]?.split(" ") || [null, null];

    if (type === "Bearer" && token) {
        const decodedJwt = jwt.decode(token, { json: true });

        if (decodedJwt && decodedJwt.sub) {
            const user = parseInt(decodedJwt.sub);
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
    return jwt.sign({ "sub": id, "name": name, "iat": Math.round(Date.now() / 1000) }, secrets.jwt)
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

        app.post("/user", async (req, res) => {
            const { name, password } = req.body;

            const createUserRespons = await createUser(conn, name, password);
            res.send(createUserRespons);

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

            const userId = getReqUserId(req);

            if (!userId || !id) {
                res.sendStatus(401);
                return;
            }

            const conversation = await getConversation(conn, userId, id);
            res.send(conversation);
        });

        app.get("/conversations", async (req, res) => {
            const userId = getReqUserId(req);

            if (!userId) {
                res.sendStatus(401);
                return;
            }


            const conversation = await getConversations(conn, userId);
            res.send(conversation);
        });


        app.post("/send", async (req, res) => {
            const { content, reciver } = req.body;
            const userId = getReqUserId(req);

            if (!userId) {
                res.sendStatus(401);
                return;
            }

            const messageRresponse = await sendMessage(conn, content, userId, reciver);
            res.send(messageRresponse);

        });

        app.listen(port, () =>
            console.log(`Example app listening on port ${port}!`),
        );

    }).catch(err => {
        //not connected
    });
