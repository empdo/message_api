import express from 'express';
import mariadb from 'mariadb';
import jwt from 'jsonwebtoken';
import bcrypt, { hash } from 'bcrypt'; 
import secrets from "./secrets.json";


const pool = mariadb.createPool({
  host: '192.168.0.153',
  user: 'emil',
  password: secrets.mariadbPassword,
  database: 'message_app',
  connectionLimit: 5
});


var app = express();
app.use(express.json());
const port = 4789

var users = {
  "aaron": {
    "något": "något"
  }
}

let getTableData = async (conn: mariadb.PoolConnection, table: string) => {
  const res = await conn.query(`select * from ${table};`)

  return res;

}

let sendMessage = async (conn: mariadb.PoolConnection, content: string, sender: number, reciver: number)  => {
      return conn.query("INSERT INTO messages (content, sender, receiver) VALUES (?, ?, ?);", [content, sender, reciver]);
}

const createUser = async (conn: mariadb.PoolConnection, name: string, password: string) => {

  const passwordHash = await bcrypt.hash(password, 10);

  const insertResponse = await conn.query("INSERT INTO users (name, password) VALUES (?, ?);", [name, passwordHash]);

  return jwt.sign({"sub": insertResponse.insertId, "name": name, "iat": Math.round(Date.now() / 1000)}, secrets.jwt);
  
}

pool.getConnection()
  .then(conn => {

    app.post("/user", async (req, res) => {
      const {name, password} = req.body;

      const createUserRespons = await createUser(conn, name, password);
      res.send(createUserRespons);
    });

    app.get("/users", async (req, res) => {
      const users = await getTableData(conn, "users");
      res.send(users);
    });

    app.get("/messages", async (req, res) => {
      const messages = await getTableData(conn, "messages");
      res.send(messages);
    });

    app.post("/send", async (req, res) => {
      const {content, sender, reciver} = req.body;

      const messageRresponse = await sendMessage(conn, content, sender, reciver);
      res.send(messageRresponse);
    });

    app.listen(port, () =>
      console.log(`Example app listening on port ${port}!`),
    );

  }).catch(err => {
    //not connected
  });