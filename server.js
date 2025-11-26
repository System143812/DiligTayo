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
    socket.on('getUsername', (data) => {
        socket.username = data.username || "Unknown User";
    });
    // const cookies = cookie.parse(socket.handshake.headers.cookie || "");
    // socket.username = cookies.username || "Unknown User";
    socket.on('waterPlant', (data) => {
        io.emit('createLog', {username: socket.username, timestamp: data.timestamp});
    });
});

const PORT = 3007;
server.listen(PORT, '0.0.0.0', () => {
    console.log(`Server is running on port: ${PORT}`);
});
