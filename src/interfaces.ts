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