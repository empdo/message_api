import { WebSocket } from "ws";
import * as jwt from "jsonwebtoken";
import { Message } from "./interfaces";

import { app, config, em } from "./index"; //kom på något bra sätt istäöllet för att importera app

let connections: { [id: string]: WebSocket[] } = {};

const sendFromEm = (type: number, message: any, id: number) => {
  const websockets = connections[id];

  if (!websockets) {
    return;
  }

  websockets.forEach((ws) => {
    ws.send(
      JSON.stringify({
        type: type,
        message,
      })
    );
  });
};

em.on("dbChange", (message: Message) => {
  sendFromEm(1, message, message.receiver);
});

em.on("picChange", (id: number) => {
  sendFromEm(2, "change", id);
});

app.ws("/", (ws, req) => {
  ws.on("message", (data) => {
    const JSONData = JSON.parse(data.toString());

    if (JSONData.action === "listen") {
      try {
        jwt.verify(JSONData.token, config.jwtSecret);
      } catch (err) {
        return null;
      }
      const token = jwt.decode(JSONData.token, { json: true });

      const sub = token?.sub;

      if (sub) {
        connections[sub] = [...(connections[sub] || []), ws];

        console.log(connections);
      }
    }
  });

  ws.on("close", () => {
    const key = Object.keys(connections).find((key) =>
      connections[key].includes(ws)
    );

    if (key) {
      connections[key] = [];
    }

    console.log(connections);
  });
});
