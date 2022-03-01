import { WebSocket } from "ws";
import * as jwt from "jsonwebtoken";
import { Message } from "./interfaces";

import { app, config, em} from "./index"; //kom på något bra sätt istäöllet för att importera app

let connections: { [id: string]: WebSocket[] } = {};

em.on('dbChange', (message: Message) => {
    const websockets = connections[message.receiver];

    if (!websockets) {
        return;
    }

    websockets.forEach(ws => {
        ws.send(JSON.stringify({
            message
        }));
    });
});

app.ws("/", (ws, req) => {
    ws.on('message', data => {

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
                connections[sub] = [...(connections[sub] || []), ws]

                console.log(connections);
            }
        }
    });

    ws.on('close', () => {
        const key = Object.keys(connections).find(key => connections[key].includes(ws));

        if (key) {
            connections[key] = [];
        }

        console.log(connections);
    });
});