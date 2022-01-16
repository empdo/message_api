import express from 'express';
import mariadb from 'mariadb';
import jwt from 'jsonwebtoken';
import bcrypt, { hash } from 'bcrypt'; 
import secrets from "./secrets.json";
import { getTypeParameterOwner } from 'typescript';


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

  return createToken(name, insertResponse.insertId);
  
}

const createToken = (name: string, id: number) => {
  return jwt.sign({"sub": id, "name": name, "iat": Math.round(Date.now() / 1000)}, secrets.jwt)
}

const getToken = async (conn: mariadb.PoolConnection, name: string, password: string) => {

        const informationResponse = await conn.query("select * from users where name=?;", [name]);

        if(!(informationResponse[0]) && !(await bcrypt.compare(password, (informationResponse[0]).password))) {
          return null;
        }

        return createToken(name, informationResponse.insertId);

}

pool.getConnection()
  .then(conn => {

    app.post("/user", async (req, res) => {
      const {name, password} = req.body;

      const createUserRespons = await createUser(conn, name, password);
      res.send(createUserRespons);
    });

    app.post("/auth", async (req, res) => {
        const {name, password} = req.body;

        res.send( await getToken(conn, name, password));
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