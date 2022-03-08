export interface User {
    id: number;
    name: string;
    picture: string | undefined;
}

export interface Conversation {
    id: number,
    content: string,
    sender: number,
    receiver: number,
    date: number,
    lastmessage: number,
}

export interface Message {
    id: number;
    sender: number;
    receiver: number;
    date: number;
    content: string;
}

export type Config = {
    [key: string]: any,
    host: string,
    jwtSecret: string,
    mariadb: {
        host: string,
        user: string,
        password: string,
        database: string,
        port: number
    },
    port: number
};
