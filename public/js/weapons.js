// Weapons Data & Logic

const Weapons = {
    ar: {
        name: 'ASSAULT RIFLE',
        damage: 25,
        fireRate: 100, // ms between shots
        magSize: 30,
        reloadTime: 2000,
        spread: 0.05,
        adsSpread: 0.01, // highly accurate when ADS
        adsZoom: 1.5,
        isAutomatic: true,
        reloadType: 'mag'
    },
    pistol: {
        name: 'PISTOL',
        damage: 35,
        fireRate: 200,
        magSize: 12,
        reloadTime: 1200,
        spread: 0.02,
        adsSpread: 0.005,
        adsZoom: 1.2,
        isAutomatic: false,
        reloadType: 'mag'
    },
    sniper: {
        name: 'SNIPER RIFLE',
        damage: 100,
        fireRate: 1500, // Bolt action delay
        magSize: 5,
        reloadTime: 3000,
        spread: 0.1, // terrible hip fire
        adsSpread: 0, // perfect accuracy
        adsZoom: 3.0,
        isAutomatic: false,
        reloadType: 'mag'
    },
    shotgun: {
        name: 'SHOTGUN',
        damage: 15, // per pellet
        pellets: 8,
        fireRate: 800, // Pump action delay
        magSize: 6,
        reloadTime: 500, // per shell
        spread: 0.15, // wide spread
        adsSpread: 0.1, // slightly tighter
        adsZoom: 1.2,
        isAutomatic: false,
        reloadType: 'shell'
    }
};

class WeaponController {
    constructor(camera, ui, socket) {
        this.camera = camera;
        this.ui = ui;
        this.socket = socket;
        
        this.currentWeaponType = 'ar';
        this.weapon = Weapons[this.currentWeaponType];
        
        this.ammo = this.weapon.magSize;
        this.lastFireTime = 0;
        this.isReloading = false;
        this.isADS = false;

        this.raycaster = new THREE.Raycaster();
        
        this.ui.updateAmmo(this.ammo, this.weapon.magSize, this.weapon.name);
    }

    setWeapon(type) {
        this.currentWeaponType = type;
        this.weapon = Weapons[type];
        this.ammo = this.weapon.magSize;
        this.isReloading = false;
        this.setADS(false);
        this.ui.updateAmmo(this.ammo, this.weapon.magSize, this.weapon.name);
    }

    setADS(state) {
        if (this.isReloading) return;
        this.isADS = state;
        if (state) {
            this.camera.fov = 75 / this.weapon.adsZoom;
            document.getElementById('crosshair').style.opacity = this.currentWeaponType === 'sniper' ? 0 : 0.5;
        } else {
            this.camera.fov = 75;
            document.getElementById('crosshair').style.opacity = 1;
        }
        this.camera.updateProjectionMatrix();
    }

    reload() {
        if (this.isReloading || this.ammo === this.weapon.magSize) return;
        
        this.isReloading = true;
        this.setADS(false);
        this.ui.updateAmmo('RELOADING', '', this.weapon.name);

        if (this.weapon.reloadType === 'mag') {
            setTimeout(() => {
                this.ammo = this.weapon.magSize;
                this.isReloading = false;
                this.ui.updateAmmo(this.ammo, this.weapon.magSize, this.weapon.name);
            }, this.weapon.reloadTime);
        } else if (this.weapon.reloadType === 'shell') {
            // Shotgun reload loop
            const loadShell = () => {
                if (!this.isReloading) return; // interrupted
                this.ammo++;
                this.ui.updateAmmo(this.ammo, this.weapon.magSize, this.weapon.name);
                
                if (this.ammo < this.weapon.magSize) {
                    setTimeout(loadShell, this.weapon.reloadTime);
                } else {
                    this.isReloading = false;
                }
            };
            setTimeout(loadShell, this.weapon.reloadTime);
        }
    }

    shoot(scene, playersData, otherPlayersMeshes, otherNPCsMeshes = {}) {
        if (this.isReloading) {
            // Interrupt shotgun reload if click
            if (this.weapon.reloadType === 'shell' && this.ammo > 0) {
                this.isReloading = false;
            } else {
                return false;
            }
        }
        if (this.ammo <= 0) {
            this.reload();
            return false;
        }

        const now = Date.now();
        if (now - this.lastFireTime < this.weapon.fireRate) return false;

        this.lastFireTime = now;
        this.ammo--;
        this.ui.updateAmmo(this.ammo, this.weapon.magSize, this.weapon.name);

        // Apply visual recoil
        this.camera.rotation.x += (Math.random() * 0.05 + 0.02) * (this.isADS ? 0.2 : 1);

        const spread = this.isADS ? this.weapon.adsSpread : this.weapon.spread;
        const pellets = this.weapon.pellets || 1;

        // Origin of ray
        const origin = new THREE.Vector3();
        this.camera.getWorldPosition(origin);

        for (let i = 0; i < pellets; i++) {
            // Calculate spread direction
            const direction = new THREE.Vector3(0, 0, -1);
            direction.applyQuaternion(this.camera.quaternion);
            
            // Add random spread
            direction.x += (Math.random() - 0.5) * spread;
            direction.y += (Math.random() - 0.5) * spread;
            direction.z += (Math.random() - 0.5) * spread;
            direction.normalize();

            // Raycast
            this.raycaster.set(origin, direction);
            
            // Check collisions with players and NPCs
            // We need to raycast against the hitboxes of other players and NPCs
            const intersectables = [];
            for (let id in otherPlayersMeshes) {
                intersectables.push(otherPlayersMeshes[id]);
            }
            for (let id in otherNPCsMeshes) {
                intersectables.push(otherNPCsMeshes[id]);
            }
            
            // Also add environment meshes if we had them here, but for now just players
            // and we'll trust the server or client for walls
            
            const intersects = this.raycaster.intersectObjects(intersectables, true);
            
            let hitPoint = origin.clone().add(direction.clone().multiplyScalar(100)); // default tracer end
            
            if (intersects.length > 0) {
                const hit = intersects[0];
                hitPoint = hit.point;
                
                // Identify which player was hit
                let hitMesh = hit.object;
                while (hitMesh.parent && !hitMesh.userData.id) {
                    hitMesh = hitMesh.parent;
                }
                
                if (hitMesh.userData.id) {
                    // Check headshot (if y is high up relative to mesh root)
                    const hitHeight = hit.point.y - hitMesh.position.y;
                    const isHeadshot = hitHeight > 1.2; // approx head height
                    
                    const damage = isHeadshot ? this.weapon.damage * 1.5 : this.weapon.damage;
                    
                    this.socket.emit('hit', {
                        targetId: hitMesh.userData.id,
                        damage: damage,
                        isHeadshot: isHeadshot,
                        isNPC: hitMesh.userData.isNPC || false
                    });

                    this.ui.showHitMarker(isHeadshot);
                }
            }

            // Emit shoot event for tracers
            this.socket.emit('shoot', {
                origin: origin,
                hitPoint: hitPoint,
                weaponType: this.currentWeaponType
            });
            
            // Draw local tracer
            this.drawTracer(scene, origin, hitPoint);
        }

        return true;
    }

    drawTracer(scene, origin, end) {
        const material = new THREE.LineBasicMaterial({ color: 0xffffaa, linewidth: 2 });
        const points = [origin, end];
        const geometry = new THREE.BufferGeometry().setFromPoints(points);
        const line = new THREE.Line(geometry, material);
        scene.add(line);
        
        // Remove tracer after short time
        setTimeout(() => {
            scene.remove(line);
            geometry.dispose();
            material.dispose();
        }, 50);
    }
}
