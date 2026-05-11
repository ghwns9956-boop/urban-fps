// Main Game Logic

let camera, scene, renderer, controls;
let socket;
let ui;
let weaponController;

const otherPlayersMeshes = {};
const otherNPCsMeshes = {};
let isDead = true;

// Movement state
let moveForward = false;
let moveBackward = false;
let moveLeft = false;
let moveRight = false;
const velocity = new THREE.Vector3();
const direction = new THREE.Vector3();
let prevTime = performance.now();

init();
animate();

function init() {
    socket = io();
    ui = new UIManager();

    // Scene setup
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x87ceeb); // Sky blue
    scene.fog = new THREE.Fog(0x87ceeb, 0, 150);

    // Camera setup
    camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
    camera.position.y = 1.6; // Eye level

    weaponController = new WeaponController(camera, ui, socket);

    // Renderer
    renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    document.getElementById('game-container').appendChild(renderer.domElement);

    // Controls
    controls = new THREE.PointerLockControls(camera, document.body);
    
    document.getElementById('instructions').addEventListener('click', () => {
        if (!isDead) controls.lock();
    });

    controls.addEventListener('lock', () => {
        ui.blocker.style.display = 'none';
    });

    controls.addEventListener('unlock', () => {
        if (!isDead) ui.blocker.style.display = 'flex';
    });

    buildCityMap();
    setupInput();
    setupNetworking();

    window.addEventListener('resize', onWindowResize);
    
    // Weapon Select logic
    document.querySelectorAll('.weapon-card').forEach(card => {
        card.addEventListener('click', () => {
            const weaponType = card.getAttribute('data-weapon');
            weaponController.setWeapon(weaponType);
            ui.hideRespawnScreen();
            
            // Ask server to spawn us
            socket.emit('spawn', weaponType);
        });
    });
}

function buildCityMap() {
    // Lighting
    const hemiLight = new THREE.HemisphereLight(0xffffff, 0x444444);
    hemiLight.position.set(0, 200, 0);
    scene.add(hemiLight);

    const dirLight = new THREE.DirectionalLight(0xffffff);
    dirLight.position.set(0, 200, 100);
    scene.add(dirLight);

    // Floor
    const floorGeo = new THREE.PlaneGeometry(200, 200);
    const floorMat = new THREE.MeshLambertMaterial({ color: 0x333333 }); // Asphalt
    const floor = new THREE.Mesh(floorGeo, floorMat);
    floor.rotation.x = -Math.PI / 2;
    scene.add(floor);

    // Buildings (Random blocks)
    const boxGeo = new THREE.BoxGeometry(1, 1, 1);
    const boxMat = new THREE.MeshLambertMaterial({ color: 0x888888 });

    for (let i = 0; i < 50; i++) {
        const mesh = new THREE.Mesh(boxGeo, boxMat);
        mesh.position.x = Math.floor(Math.random() * 20 - 10) * 8;
        mesh.position.y = Math.floor(Math.random() * 5) * 2 + 2;
        mesh.position.z = Math.floor(Math.random() * 20 - 10) * 8;
        
        mesh.scale.x = Math.random() * 4 + 2;
        mesh.scale.y = mesh.position.y * 2;
        mesh.scale.z = Math.random() * 4 + 2;
        
        scene.add(mesh);
    }
}

function setupInput() {
    document.addEventListener('keydown', (event) => {
        switch (event.code) {
            case 'KeyW': moveForward = true; break;
            case 'KeyA': moveLeft = true; break;
            case 'KeyS': moveBackward = true; break;
            case 'KeyD': moveRight = true; break;
            case 'KeyR': weaponController.reload(); break;
            case 'Tab': 
                event.preventDefault();
                ui.toggleKillLog(true); 
                break;
        }
    });

    document.addEventListener('keyup', (event) => {
        switch (event.code) {
            case 'KeyW': moveForward = false; break;
            case 'KeyA': moveLeft = false; break;
            case 'KeyS': moveBackward = false; break;
            case 'KeyD': moveRight = false; break;
            case 'Tab': 
                event.preventDefault();
                ui.toggleKillLog(false); 
                break;
        }
    });

    document.addEventListener('mousedown', (event) => {
        if (isDead || !controls.isLocked) return;
        
        if (event.button === 0) { // Left click
            // Handle automatic weapons
            if (weaponController.weapon.isAutomatic) {
                const fireLoop = setInterval(() => {
                    if (!weaponController.shoot(scene, {}, otherPlayersMeshes, otherNPCsMeshes)) {
                        clearInterval(fireLoop);
                    }
                }, 50);
                
                const stopFire = () => {
                    clearInterval(fireLoop);
                    document.removeEventListener('mouseup', stopFire);
                };
                document.addEventListener('mouseup', stopFire);
            } else {
                weaponController.shoot(scene, {}, otherPlayersMeshes, otherNPCsMeshes);
            }
        } else if (event.button === 2) { // Right click
            weaponController.setADS(true);
        }
    });

    document.addEventListener('mouseup', (event) => {
        if (event.button === 2) {
            weaponController.setADS(false);
        }
    });
}

function setupNetworking() {
    socket.on('currentPlayers', (players) => {
        for (let id in players) {
            if (id !== socket.id && !players[id].isDead) {
                addOtherPlayer(players[id]);
            }
        }
    });

    socket.on('newPlayer', (playerData) => {
        if (!playerData.isDead) addOtherPlayer(playerData);
    });

    socket.on('playerSpawned', (playerData) => {
        if (playerData.id === socket.id) {
            // Local player spawned
            isDead = false;
            camera.position.set(playerData.x, 1.6, playerData.z);
            ui.updateHealth(100);
            controls.lock();
        } else {
            // Other player spawned
            if (!otherPlayersMeshes[playerData.id]) {
                addOtherPlayer(playerData);
            } else {
                const mesh = otherPlayersMeshes[playerData.id];
                mesh.position.set(playerData.x, playerData.y, playerData.z);
                mesh.visible = true;
            }
        }
    });

    socket.on('playerMoved', (playerData) => {
        const mesh = otherPlayersMeshes[playerData.id];
        if (mesh && !playerData.isDead) {
            // Very simple interpolation could go here, but direct set for now
            mesh.position.set(playerData.x, playerData.y, playerData.z);
            mesh.rotation.y = playerData.rotationY;
            // Note: we'd also sync pitch for the gun/head looking up and down
        }
    });

    socket.on('playerShot', (data) => {
        // Draw remote tracer
        weaponController.drawTracer(scene, data.origin, data.hitPoint);
    });

    socket.on('healthUpdate', (data) => {
        if (data.id === socket.id) {
            ui.updateHealth(data.health);
            ui.showDamage();
        }
    });

    socket.on('playerKilled', (data) => {
        // Add to kill log
        const killerName = data.killerId === socket.id ? 'You' : data.killerId.substring(0, 4);
        const victimName = data.targetId === socket.id ? 'You' : data.targetId.substring(0, 4);
        ui.addKillLog(killerName, data.weapon, victimName, data.isHeadshot);

        if (data.targetId === socket.id) {
            // We died
            isDead = true;
            camera.position.y = 0.2; // fall to ground
            controls.unlock();
            setTimeout(() => {
                ui.showRespawnScreen();
            }, 1000);
        } else {
            // Someone else died
            const mesh = otherPlayersMeshes[data.targetId];
            if (mesh) mesh.visible = false;
        }
    });

    socket.on('playerDisconnected', (id) => {
        const mesh = otherPlayersMeshes[id];
        if (mesh) {
            scene.remove(mesh);
            delete otherPlayersMeshes[id];
        }
    });

    // NPC Networking
    socket.on('currentNPCs', (npcs) => {
        for (let id in npcs) {
            if (!npcs[id].isDead) {
                addNPC(npcs[id]);
            }
        }
    });

    socket.on('newNPC', (npcData) => {
        if (!npcData.isDead) addNPC(npcData);
    });

    socket.on('npcUpdate', (npcs) => {
        for (let id in npcs) {
            const npcData = npcs[id];
            const mesh = otherNPCsMeshes[id];
            if (mesh && !npcData.isDead) {
                mesh.position.set(npcData.x, npcData.y, npcData.z);
                mesh.rotation.y = npcData.rotationY;
                mesh.visible = true;
            } else if (npcData.isDead && mesh) {
                mesh.visible = false;
            }
        }
    });

    socket.on('npcKilled', (data) => {
        const killerName = data.killerId === socket.id ? 'You' : data.killerId.substring(0, 4);
        ui.addKillLog(killerName, data.weapon, 'Zombie Bot', data.isHeadshot);
        
        const mesh = otherNPCsMeshes[data.targetId];
        if (mesh) {
            mesh.visible = false;
        }
    });
}

function addOtherPlayer(playerData) {
    const playerGroup = Models.createHumanoid(false);
    playerGroup.position.set(playerData.x, playerData.y, playerData.z);
    playerGroup.userData = { id: playerData.id, isNPC: false };
    
    // Add their weapon
    const weaponModel = Models.createWeaponModel(playerData.weapon);
    playerGroup.weaponPivot.add(weaponModel);

    scene.add(playerGroup);
    otherPlayersMeshes[playerData.id] = playerGroup;
}

function addNPC(npcData) {
    const npcGroup = Models.createHumanoid(true); // true = isNPC -> Red clothing
    npcGroup.position.set(npcData.x, npcData.y, npcData.z);
    npcGroup.userData = { id: npcData.id, isNPC: true };
    
    // Add knife
    const weaponModel = Models.createWeaponModel('knife');
    npcGroup.weaponPivot.add(weaponModel);

    scene.add(npcGroup);
    otherNPCsMeshes[npcData.id] = npcGroup;
}

function onWindowResize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
}

function animate() {
    requestAnimationFrame(animate);

    const time = performance.now();
    const delta = (time - prevTime) / 1000;

    if (controls.isLocked === true && !isDead) {
        velocity.x -= velocity.x * 10.0 * delta;
        velocity.z -= velocity.z * 10.0 * delta;

        direction.z = Number(moveForward) - Number(moveBackward);
        direction.x = Number(moveRight) - Number(moveLeft);
        direction.normalize(); // consistent diagonal movement

        // Slower movement when ADS
        const speedMultiplier = weaponController.isADS ? 20.0 : 40.0;

        if (moveForward || moveBackward) velocity.z -= direction.z * speedMultiplier * delta;
        if (moveLeft || moveRight) velocity.x -= direction.x * speedMultiplier * delta;

        controls.moveRight(-velocity.x * delta);
        controls.moveForward(-velocity.z * delta);

        // Simple collision boundary check (very rough for map edge)
        if (camera.position.x > 95) camera.position.x = 95;
        if (camera.position.x < -95) camera.position.x = -95;
        if (camera.position.z > 95) camera.position.z = 95;
        if (camera.position.z < -95) camera.position.z = -95;

        // Send position to server
        socket.emit('playerMovement', {
            x: camera.position.x,
            y: camera.position.y - 1.6, // send floor position
            z: camera.position.z,
            rotationY: camera.rotation.y,
            pitch: camera.rotation.x
        });
    }

    prevTime = time;
    renderer.render(scene, camera);
}
