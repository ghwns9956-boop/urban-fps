// Main Game Logic

let camera, scene, renderer, controls;
let socket;
let ui;
let weaponController;

const otherPlayersMeshes = {};
const otherNPCsMeshes = {};
let isDead = true;
let localWeaponGroup;
let weaponKickback = 0;
const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);


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
    camera.rotation.order = 'YXZ';
    scene.add(camera); // Must add camera to scene to see children (FPV weapon)

    weaponController = new WeaponController(camera, ui, socket);

    // Renderer
    renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    document.getElementById('game-container').appendChild(renderer.domElement);

    if (isMobile) {
        document.getElementById('landscape-overlay').classList.add('mobile-active');
        document.getElementById('mobile-controls').style.display = 'block';
        document.getElementById('blocker').style.display = 'none'; // hide PC blocker

        controls = {
            isLocked: false,
            lock: function() { this.isLocked = true; },
            unlock: function() { this.isLocked = false; },
            moveForward: function(distance) {
                const vec = new THREE.Vector3(0, 0, -1);
                vec.applyQuaternion(camera.quaternion);
                vec.y = 0;
                vec.normalize();
                camera.position.addScaledVector(vec, distance);
            },
            moveRight: function(distance) {
                const vec = new THREE.Vector3(1, 0, 0);
                vec.applyQuaternion(camera.quaternion);
                vec.y = 0;
                vec.normalize();
                camera.position.addScaledVector(vec, distance);
            }
        };
        setupMobileInput();
    } else {
        // Controls for PC
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
        
        setupInput(); // PC Input
    }

    buildCityMap();
    setupNetworking();

    window.addEventListener('resize', onWindowResize);
    
    // Weapon Select logic
    document.querySelectorAll('.weapon-card').forEach(card => {
        card.addEventListener('click', () => {
            const weaponType = card.getAttribute('data-weapon');
            weaponController.setWeapon(weaponType);
            updateLocalWeaponModel(weaponType);
            ui.hideRespawnScreen();
            
            // Ask server to spawn us
            socket.emit('spawn', weaponType);
            
            // Request pointer lock immediately after a short delay
            setTimeout(() => { controls.lock(); }, 100);
        });
    });
}

function updateLocalWeaponModel(weaponType) {
    if (localWeaponGroup) {
        camera.remove(localWeaponGroup);
    }
    localWeaponGroup = Models.createWeaponModel(weaponType);
    // Position it bottom right relative to camera
    localWeaponGroup.position.set(0.3, -0.3, -0.6);
    
    // Scale it down slightly so it fits nicely on screen
    localWeaponGroup.scale.set(0.5, 0.5, 0.5);
    
    camera.add(localWeaponGroup);
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

function setupMobileInput() {
    let touchLookId = null;
    let touchMoveId = null;
    let joystickStart = {x: 0, y: 0};
    const euler = new THREE.Euler(0, 0, 0, 'YXZ');
    const PI_2 = Math.PI / 2;

    const joystickZone = document.getElementById('joystick-zone');
    const joystickKnob = document.getElementById('joystick-knob');
    
    document.addEventListener('touchstart', handleTouch, {passive: false});
    document.addEventListener('touchmove', handleTouchMove, {passive: false});
    document.addEventListener('touchend', handleTouchEnd, {passive: false});

    function handleTouch(e) {
        if (e.target.classList.contains('mobile-btn') || e.target.closest('.weapon-card')) return;
        
        for (let i=0; i<e.changedTouches.length; i++) {
            const t = e.changedTouches[i];
            if (t.clientX < window.innerWidth / 2 && touchMoveId === null) {
                // Left side: Joystick
                touchMoveId = t.identifier;
                joystickStart.x = t.clientX;
                joystickStart.y = t.clientY;
                joystickZone.style.left = (t.clientX - 75) + 'px';
                joystickZone.style.top = (t.clientY - 75) + 'px';
                joystickZone.style.bottom = 'auto';
                joystickKnob.style.transform = `translate(-50%, -50%)`;
            } else if (t.clientX >= window.innerWidth / 2 && touchLookId === null) {
                // Right side: Look
                touchLookId = t.identifier;
                lastTouchX = t.clientX;
                lastTouchY = t.clientY;
            }
        }
    }

    let lastTouchX = 0, lastTouchY = 0;

    function handleTouchMove(e) {
        if (e.target.id === 'weapon-select' || e.target.closest('.weapon-cards')) return; // allow scrolling weapon cards
        e.preventDefault(); // Prevent scrolling
        for (let i=0; i<e.changedTouches.length; i++) {
            const t = e.changedTouches[i];
            if (t.identifier === touchMoveId) {
                // Move logic
                let dx = t.clientX - joystickStart.x;
                let dy = t.clientY - joystickStart.y;
                const distance = Math.sqrt(dx*dx + dy*dy);
                const maxDist = 50;
                
                if (distance > maxDist) {
                    dx = (dx / distance) * maxDist;
                    dy = (dy / distance) * maxDist;
                }
                joystickKnob.style.transform = `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px))`;
                
                // Map to WASD analog-like
                moveRight = dx / maxDist > 0.2;
                moveLeft = dx / maxDist < -0.2;
                moveBackward = dy / maxDist > 0.2;
                moveForward = dy / maxDist < -0.2;
                
            } else if (t.identifier === touchLookId) {
                if (!isDead && controls.isLocked) {
                    // Look logic
                    const movementX = t.clientX - lastTouchX;
                    const movementY = t.clientY - lastTouchY;
                    lastTouchX = t.clientX;
                    lastTouchY = t.clientY;

                    // Apply sensitivity multiplier
                    const sensitivity = weaponController.isADS ? 0.002 : 0.005;

                    euler.setFromQuaternion(camera.quaternion);
                    euler.y -= movementX * sensitivity;
                    euler.x -= movementY * sensitivity;
                    euler.x = Math.max(-PI_2, Math.min(PI_2, euler.x));
                    camera.quaternion.setFromEuler(euler);
                }
            }
        }
    }

    function handleTouchEnd(e) {
        for (let i=0; i<e.changedTouches.length; i++) {
            const t = e.changedTouches[i];
            if (t.identifier === touchMoveId) {
                touchMoveId = null;
                moveForward = moveBackward = moveLeft = moveRight = false;
                joystickKnob.style.transform = `translate(-50%, -50%)`;
                joystickZone.style.left = '20px';
                joystickZone.style.bottom = '20px';
                joystickZone.style.top = 'auto';
            } else if (t.identifier === touchLookId) {
                touchLookId = null;
            }
        }
    }

    // Buttons
    let fireLoop = null;
    const btnFire = document.getElementById('btn-fire');
    btnFire.addEventListener('touchstart', (e) => {
        e.preventDefault();
        if (isDead || !controls.isLocked) return;
        if (weaponController.weapon.isAutomatic) {
            fireLoop = setInterval(() => {
                if (!weaponController.shoot(scene, {}, otherPlayersMeshes, otherNPCsMeshes)) {
                    clearInterval(fireLoop);
                } else {
                    weaponKickback = 0.1;
                }
            }, 50);
        } else {
            if (weaponController.shoot(scene, {}, otherPlayersMeshes, otherNPCsMeshes)) {
                weaponKickback = 0.1;
            }
        }
    });
    btnFire.addEventListener('touchend', (e) => {
        e.preventDefault();
        if (fireLoop) clearInterval(fireLoop);
    });
    // Add touchcancel to stop firing if finger slides off the button
    btnFire.addEventListener('touchcancel', (e) => {
        if (fireLoop) clearInterval(fireLoop);
    });

    const btnAds = document.getElementById('btn-ads');
    btnAds.addEventListener('touchstart', (e) => {
        e.preventDefault();
        if (!isDead && controls.isLocked) weaponController.setADS(true);
    });
    btnAds.addEventListener('touchend', (e) => {
        e.preventDefault();
        weaponController.setADS(false);
    });

    const btnReload = document.getElementById('btn-reload');
    btnReload.addEventListener('touchstart', (e) => {
        e.preventDefault();
        if (!isDead && controls.isLocked) weaponController.reload();
    });
}

function setupInput() {
    // Prevent right-click menu from appearing when aiming down sights
    document.addEventListener('contextmenu', event => event.preventDefault());

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
                    } else {
                        weaponKickback = 0.1;
                    }
                }, 50);
                
                const stopFire = () => {
                    clearInterval(fireLoop);
                    document.removeEventListener('mouseup', stopFire);
                };
                document.addEventListener('mouseup', stopFire);
            } else {
                if (weaponController.shoot(scene, {}, otherPlayersMeshes, otherNPCsMeshes)) {
                    weaponKickback = 0.1;
                }
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

        // Weapon bobbing, kickback, and ADS positioning
        if (localWeaponGroup) {
            // Kickback recovery
            if (weaponKickback > 0) {
                weaponKickback -= delta * 0.5; // recover speed
                if (weaponKickback < 0) weaponKickback = 0;
            }
            
            // Apply Kickback
            localWeaponGroup.position.z = -0.6 + weaponKickback;
            localWeaponGroup.rotation.x = weaponKickback * 0.5;
            
            // Move weapon to center if ADS
            if (weaponController.isADS) {
                localWeaponGroup.position.x = 0;
                localWeaponGroup.position.y = -0.15;
            } else {
                localWeaponGroup.position.x = 0.3;
                
                // Bobbing when moving (only hip fire)
                if ((moveForward || moveBackward || moveLeft || moveRight)) {
                    const bob = Math.sin(time * 0.01) * 0.02;
                    localWeaponGroup.position.y = -0.3 + bob;
                } else {
                    localWeaponGroup.position.y = -0.3;
                }
            }
        }
    }

    prevTime = time;
    renderer.render(scene, camera);
}
