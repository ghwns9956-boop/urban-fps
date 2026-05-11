// Procedural generation of 3D Models

const Models = {
    // Colors
    skinColor: 0xffccaa,
    clothColor: 0x223344,
    gunMetal: 0x222222,
    darkMetal: 0x111111,
    woodColor: 0x5c4033,
    oliveDrab: 0x4b5320,

    createHumanoid: function(isNPC = false) {
        const group = new THREE.Group();
        
        // Materials
        const skinMat = new THREE.MeshLambertMaterial({ color: this.skinColor });
        const clothMat = new THREE.MeshLambertMaterial({ color: isNPC ? 0xaa2222 : this.clothColor });
        
        // Head
        const headGeo = new THREE.BoxGeometry(0.8, 0.8, 0.8);
        const head = new THREE.Mesh(headGeo, skinMat);
        head.position.y = 1.6;
        
        // Glasses/Visor (to look cooler)
        const visorGeo = new THREE.BoxGeometry(0.82, 0.2, 0.2);
        const visorMat = new THREE.MeshLambertMaterial({ color: 0x111111 });
        const visor = new THREE.Mesh(visorGeo, visorMat);
        visor.position.set(0, 0.1, 0.35);
        head.add(visor);
        group.add(head);

        // Torso
        const torsoGeo = new THREE.BoxGeometry(1.2, 1.4, 0.6);
        const torso = new THREE.Mesh(torsoGeo, clothMat);
        torso.position.y = 0.7;
        group.add(torso);

        // Arms (holding weapon forward)
        const armGeo = new THREE.CylinderGeometry(0.2, 0.2, 1.2, 8);
        
        const rightArm = new THREE.Mesh(armGeo, clothMat);
        rightArm.position.set(0.8, 1.0, 0.3);
        rightArm.rotation.x = -Math.PI / 2; // Pointing forward
        rightArm.rotation.z = Math.PI / 8; // Angled in slightly
        group.add(rightArm);

        const leftArm = new THREE.Mesh(armGeo, clothMat);
        leftArm.position.set(-0.8, 1.0, 0.5);
        leftArm.rotation.x = -Math.PI / 2.5;
        leftArm.rotation.z = -Math.PI / 6;
        group.add(leftArm);

        // Legs
        const legGeo = new THREE.CylinderGeometry(0.25, 0.25, 1.4, 8);
        
        const rightLeg = new THREE.Mesh(legGeo, clothMat);
        rightLeg.position.set(0.3, -0.7, 0);
        group.add(rightLeg);

        const leftLeg = new THREE.Mesh(legGeo, clothMat);
        leftLeg.position.set(-0.3, -0.7, 0);
        group.add(leftLeg);

        // Weapon attachment point
        const weaponPivot = new THREE.Group();
        weaponPivot.position.set(0.4, 1.0, 0.8); // Positioned at hands
        group.add(weaponPivot);
        group.weaponPivot = weaponPivot;

        // Offset group so feet are at y=0
        group.position.y = 1.4; 

        return group;
    },

    createWeaponModel: function(type) {
        const weaponGroup = new THREE.Group();
        const metalMat = new THREE.MeshLambertMaterial({ color: this.gunMetal });
        const darkMetalMat = new THREE.MeshLambertMaterial({ color: this.darkMetal });
        const woodMat = new THREE.MeshLambertMaterial({ color: this.woodColor });
        const oliveMat = new THREE.MeshLambertMaterial({ color: this.oliveDrab });

        if (type === 'ar') {
            // M4 Assault Rifle
            const receiver = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.2, 0.5), metalMat);
            
            // Barrel & Handguard
            const handguard = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.6), darkMetalMat);
            handguard.rotation.x = Math.PI / 2;
            handguard.position.set(0, 0.02, 0.5);
            
            const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.4), darkMetalMat);
            barrel.rotation.x = Math.PI / 2;
            barrel.position.set(0, 0.02, 0.9);
            
            // Carry Handle (Iron sight)
            const handle = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.08, 0.3), darkMetalMat);
            handle.position.set(0, 0.14, 0.1);
            
            // Magazine (Curved)
            const mag = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.35, 0.15), metalMat);
            mag.position.set(0, -0.2, 0.15);
            mag.rotation.x = 0.2; // Slight curve forward
            
            // Grip
            const grip = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.2, 0.1), darkMetalMat);
            grip.position.set(0, -0.15, -0.15);
            grip.rotation.x = -0.2;
            
            // Stock
            const stockPipe = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.3), darkMetalMat);
            stockPipe.rotation.x = Math.PI / 2;
            stockPipe.position.set(0, 0, -0.3);
            
            const stockBody = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.25, 0.2), darkMetalMat);
            stockBody.position.set(0, -0.05, -0.45);
            
            weaponGroup.add(receiver, handguard, barrel, handle, mag, grip, stockPipe, stockBody);

        } else if (type === 'pistol') {
            // M9 Pistol
            const receiver = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.15, 0.35), darkMetalMat); // Slide
            
            const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.05), metalMat);
            barrel.rotation.x = Math.PI / 2;
            barrel.position.set(0, 0.02, 0.18);
            
            const grip = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.25, 0.12), darkMetalMat);
            grip.position.set(0, -0.15, -0.1);
            grip.rotation.x = 0.2; // angled grip
            
            // Trigger Guard
            const guard = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.1, 0.1), darkMetalMat);
            guard.position.set(0, -0.1, 0.05);

            weaponGroup.add(receiver, barrel, grip, guard);

        } else if (type === 'sniper') {
            // AWP
            const receiver = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.15, 0.7), oliveMat); // Main body
            
            // Thick long barrel
            const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 1.4), darkMetalMat);
            barrel.rotation.x = Math.PI / 2;
            barrel.position.set(0, 0.04, 0.8);
            
            // Large Scope
            const scopeMount = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.1, 0.2), darkMetalMat);
            scopeMount.position.set(0, 0.12, 0);
            const scopeBody = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.5), darkMetalMat);
            scopeBody.rotation.x = Math.PI / 2;
            scopeBody.position.set(0, 0.18, 0.05);
            
            // Thumbhole Stock
            const stock = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.25, 0.6), oliveMat);
            stock.position.set(0, -0.05, -0.6);
            
            // Magazine (small)
            const mag = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.15, 0.1), darkMetalMat);
            mag.position.set(0, -0.1, 0.1);
            
            weaponGroup.add(receiver, barrel, scopeMount, scopeBody, stock, mag);

        } else if (type === 'shotgun') {
            // Pump Shotgun
            const receiver = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.16, 0.5), darkMetalMat);
            
            // Barrel
            const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.9), darkMetalMat);
            barrel.rotation.x = Math.PI / 2;
            barrel.position.set(0, 0.04, 0.7);
            
            // Tube Magazine under barrel
            const tube = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.8), darkMetalMat);
            tube.rotation.x = Math.PI / 2;
            tube.position.set(0, -0.02, 0.65);
            
            // Wooden Pump
            const pump = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.3), woodMat);
            pump.rotation.x = Math.PI / 2;
            pump.position.set(0, -0.02, 0.5);
            
            // Grip and Stock
            const grip = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.2, 0.1), woodMat);
            grip.position.set(0, -0.15, -0.2);
            grip.rotation.x = -0.3;

            const stock = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.15, 0.4), woodMat);
            stock.position.set(0, -0.08, -0.45);
            stock.rotation.x = -0.1;
            
            weaponGroup.add(receiver, barrel, tube, pump, grip, stock);
            
        } else if (type === 'knife') {
            // Knife for NPCs
            const handle = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.08, 0.2), woodMat);
            const blade = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.1, 0.3), metalMat);
            blade.position.set(0, 0, 0.25);
            // Angle the knife down a bit for a stabbing pose
            weaponGroup.rotation.x = -Math.PI / 4;
            weaponGroup.add(handle, blade);
        }

        return weaponGroup;
    }
};
