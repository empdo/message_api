export interface User {
    id: number;
    name: string;
}

export interface Conversation {
    id: number,
    content: string,
    sender: number,
    receiver: number,
    date: number
}

export type Config = {
    [key: string]: any,
    host: strin,
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
