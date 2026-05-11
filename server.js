const express = require('express');
const app = express();
const http = require('http').Server(app);
const io = require('socket.io')(http);
const path = require('path');

app.use(express.static(path.join(__dirname, 'public')));

const players = {};
// Store current bullets/tracers? No, tracers are client side visual only.
// The server will do hit registration.

// Spawn points for the city map
const spawnPoints = [
    { x: 0, y: 0, z: 0 },
    { x: 40, y: 0, z: 40 },
    { x: -40, y: 0, z: -40 },
    { x: 40, y: 0, z: -40 },
    { x: -40, y: 0, z: 40 },
];

io.on('connection', (socket) => {
    console.log('A player connected:', socket.id);

    // Initial player state
    players[socket.id] = {
        id: socket.id,
        x: 0, y: 0, z: 0,
        rotationY: 0,
        pitch: 0,
        health: 100,
        weapon: 'ar',
        isDead: true // Start dead so they select weapon
    };

    socket.emit('currentPlayers', players);
    socket.broadcast.emit('newPlayer', players[socket.id]);

    socket.on('spawn', (weaponType) => {
        const spawn = spawnPoints[Math.floor(Math.random() * spawnPoints.length)];
        players[socket.id].x = spawn.x;
        players[socket.id].y = spawn.y; // Will adjust on client side for floor height
        players[socket.id].z = spawn.z;
        players[socket.id].health = 100;
        players[socket.id].weapon = weaponType;
        players[socket.id].isDead = false;
        
        io.emit('playerSpawned', players[socket.id]);
    });

    socket.on('playerMovement', (movementData) => {
        if (!players[socket.id] || players[socket.id].isDead) return;
        
        players[socket.id].x = movementData.x;
        players[socket.id].y = movementData.y;
        players[socket.id].z = movementData.z;
        players[socket.id].rotationY = movementData.rotationY;
        players[socket.id].pitch = movementData.pitch;

        socket.broadcast.emit('playerMoved', players[socket.id]);
    });

    socket.on('shoot', (shootData) => {
        // shootData contains { origin, direction, weaponType }
        // Broadcast to others so they can draw tracers and play sounds
        socket.broadcast.emit('playerShot', { id: socket.id, ...shootData });
    });

    socket.on('hit', (hitData) => {
        // hitData: { targetId, damage, isHeadshot }
        const target = players[hitData.targetId];
        if (target && !target.isDead) {
            target.health -= hitData.damage;
            
            if (target.health <= 0) {
                target.health = 0;
                target.isDead = true;
                // Kill log
                io.emit('playerKilled', {
                    killerId: socket.id,
                    targetId: hitData.targetId,
                    weapon: players[socket.id].weapon,
                    isHeadshot: hitData.isHeadshot
                });
            }
            io.emit('healthUpdate', { id: hitData.targetId, health: target.health });
        }
    });

    socket.on('disconnect', () => {
        console.log('Player disconnected:', socket.id);
        delete players[socket.id];
        io.emit('playerDisconnected', socket.id);
    });
});

const PORT = process.env.PORT || 3000;
http.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
