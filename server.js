import express from 'express';
import cors from 'cors';
import { Server } from 'socket.io';
import http from 'http';
import cookieParser from 'cookie-parser';
import cookie from 'cookie';

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(cookieParser());
app.use(cors());
app.use(express.json());
app.use('/', express.static('public'));

io.on("connection", (socket) => {
    const cookies = cookie.parse(socket.handshake.headers.cookie);
    socket.username = cookies.username || "Unknown user";

    
    socket.on('waterPlant', (data) => {
        io.emit('createLog', {username: socket.username, timestamp: data.timestamp});
    });
});

const PORT = 3007;
server.listen(PORT, () => {
    console.log(`Server is running on port: ${PORT}`);
});
