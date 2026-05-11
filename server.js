const express = require('express');
const app = express();
const http = require('http').Server(app);
const io = require('socket.io')(http);
const path = require('path');

app.use(express.static(path.join(__dirname, 'public')));

const players = {};
const npcs = {};
const MAX_NPCS = 8;
let npcIdCounter = 0;

const spawnPoints = [
    { x: 0, y: 0, z: 0 },
    { x: 40, y: 0, z: 40 },
    { x: -40, y: 0, z: -40 },
    { x: 40, y: 0, z: -40 },
    { x: -40, y: 0, z: 40 },
    { x: 20, y: 0, z: -20 },
    { x: -20, y: 0, z: 20 },
];

function spawnNPC() {
    const id = 'npc_' + (npcIdCounter++);
    const spawn = spawnPoints[Math.floor(Math.random() * spawnPoints.length)];
    npcs[id] = {
        id: id,
        x: spawn.x,
        y: spawn.y,
        z: spawn.z,
        rotationY: 0,
        health: 25,
        speed: 2.5, // units per second (very slow)
        lastAttackTime: 0,
        isDead: false
    };
    io.emit('newNPC', npcs[id]);
}

function updateNPCs() {
    let alivePlayerIds = Object.keys(players).filter(id => !players[id].isDead);
    
    // Ensure we have enough NPCs
    const currentNPCCount = Object.keys(npcs).filter(id => !npcs[id].isDead).length;
    if (currentNPCCount < MAX_NPCS && alivePlayerIds.length > 0) {
        if (Math.random() < 0.05) spawnNPC(); // Spawn gradually
    }

    const now = Date.now();
    const dt = 1 / 20; // 20 FPS server tick

    for (let id in npcs) {
        let npc = npcs[id];
        if (npc.isDead) continue;

        // Find closest player
        let closestPlayer = null;
        let minTargetDist = Infinity;

        for (let pid of alivePlayerIds) {
            let p = players[pid];
            let dx = p.x - npc.x;
            let dz = p.z - npc.z;
            let dist = Math.sqrt(dx*dx + dz*dz);
            if (dist < minTargetDist) {
                minTargetDist = dist;
                closestPlayer = p;
            }
        }

        if (closestPlayer) {
            // Move towards player
            let dx = closestPlayer.x - npc.x;
            let dz = closestPlayer.z - npc.z;
            
            // Rotation
            npc.rotationY = Math.atan2(dx, dz);

            if (minTargetDist > 1.5 && minTargetDist < 25.0) {
                // Chase if within aggro radius (25 units)
                npc.x += (dx / minTargetDist) * npc.speed * dt;
                npc.z += (dz / minTargetDist) * npc.speed * dt;
            } else if (minTargetDist <= 1.5) {
                // Melee Attack!
                if (now - npc.lastAttackTime > 1000) { // 1 second cooldown
                    npc.lastAttackTime = now;
                    closestPlayer.health -= 20;
                    
                    if (closestPlayer.health <= 0) {
                        closestPlayer.health = 0;
                        closestPlayer.isDead = true;
                        io.emit('playerKilled', {
                            killerId: 'Zombie Bot',
                            targetId: closestPlayer.id,
                            weapon: 'Knife',
                            isHeadshot: false
                        });
                    }
                    io.emit('healthUpdate', { id: closestPlayer.id, health: closestPlayer.health });
                }
            }
        }
    }
    
    // Broadcast NPC positions
    io.emit('npcUpdate', npcs);
}

// Start Server Loop
setInterval(updateNPCs, 1000 / 20); // 20 ticks per second

io.on('connection', (socket) => {
    console.log('A player connected:', socket.id);

    players[socket.id] = {
        id: socket.id,
        x: 0, y: 0, z: 0,
        rotationY: 0,
        pitch: 0,
        health: 100,
        weapon: 'ar',
        isDead: true
    };

    socket.emit('currentPlayers', players);
    socket.emit('currentNPCs', npcs);
    socket.broadcast.emit('newPlayer', players[socket.id]);

    socket.on('spawn', (weaponType) => {
        const spawn = spawnPoints[Math.floor(Math.random() * spawnPoints.length)];
        players[socket.id].x = spawn.x;
        players[socket.id].y = spawn.y;
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
        socket.broadcast.emit('playerShot', { id: socket.id, ...shootData });
    });

    socket.on('hit', (hitData) => {
        // hitData: { targetId, damage, isHeadshot, isNPC }
        if (hitData.isNPC) {
            const npc = npcs[hitData.targetId];
            if (npc && !npc.isDead) {
                npc.health -= hitData.damage;
                if (npc.health <= 0) {
                    npc.health = 0;
                    npc.isDead = true;
                    io.emit('npcKilled', {
                        killerId: socket.id,
                        targetId: npc.id,
                        weapon: players[socket.id].weapon,
                        isHeadshot: hitData.isHeadshot
                    });
                }
            }
        } else {
            const target = players[hitData.targetId];
            if (target && !target.isDead) {
                target.health -= hitData.damage;
                
                if (target.health <= 0) {
                    target.health = 0;
                    target.isDead = true;
                    io.emit('playerKilled', {
                        killerId: socket.id,
                        targetId: hitData.targetId,
                        weapon: players[socket.id].weapon,
                        isHeadshot: hitData.isHeadshot
                    });
                }
                io.emit('healthUpdate', { id: hitData.targetId, health: target.health });
            }
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
