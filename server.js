const express = require('express');
const app = express();
const http = require('http').createServer(app);
const io = require('socket.io')(http);

app.use(express.static(__dirname)); // Раздаем наш index.html

let players = {}; // Тут храним всех игроков

io.on('connection', (socket) => {
    console.log('Новый игрок подключился:', socket.id);

    // Создаем нового игрока на сервере
    players[socket.id] = {
        id: socket.id,
        x: 0, y: 0, z: 0,
        ry: 0,
        inventory: []
    };

    // Отправляем новому игроку список всех остальных
    socket.emit('currentPlayers', players);

    // Оповещаем остальных, что зашел новый
    socket.broadcast.emit('newPlayer', players[socket.id]);

    // Когда игрок двигается
    socket.on('playerMovement', (movementData) => {
        if (players[socket.id]) {
            players[socket.id].x = movementData.x;
            players[socket.id].y = movementData.y;
            players[socket.id].z = movementData.z;
            players[socket.id].ry = movementData.ry;
            // Рассылаем всем его новые координаты
            socket.broadcast.emit('playerMoved', players[socket.id]);
        }
    });

    // Когда кто-то выходит
    socket.on('disconnect', () => {
        console.log('Игрок ушел:', socket.id);
        delete players[socket.id];
        io.emit('playerDisconnected', socket.id);
    });
});

http.listen(3000, () => {
    console.log('СЕРВЕР ЗАПУЩЕН НА http://localhost:3000');
});