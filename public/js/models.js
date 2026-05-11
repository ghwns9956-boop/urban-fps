// Procedural generation of 3D Models

const Models = {
    // Colors
    skinColor: 0xffccaa,
    clothColor: 0x223344,
    gunMetal: 0x333333,
    woodColor: 0x5c4033,

    createHumanoid: function() {
        const group = new THREE.Group();
        
        // Materials
        const skinMat = new THREE.MeshLambertMaterial({ color: this.skinColor });
        const clothMat = new THREE.MeshLambertMaterial({ color: this.clothColor });
        
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
        const woodMat = new THREE.MeshLambertMaterial({ color: this.woodColor });

        if (type === 'ar') {
            // Assault Rifle
            const receiver = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.2, 0.6), metalMat);
            const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.8), metalMat);
            barrel.rotation.x = Math.PI / 2;
            barrel.position.z = 0.6;
            const mag = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.3, 0.15), metalMat);
            mag.position.set(0, -0.2, 0.1);
            mag.rotation.x = 0.2;
            const stock = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.2, 0.4), metalMat);
            stock.position.set(0, -0.05, -0.4);
            weaponGroup.add(receiver, barrel, mag, stock);

        } else if (type === 'pistol') {
            // Pistol
            const receiver = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.15, 0.3), metalMat);
            const grip = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.25, 0.1), metalMat);
            grip.position.set(0, -0.15, -0.1);
            grip.rotation.x = 0.2;
            weaponGroup.add(receiver, grip);

        } else if (type === 'sniper') {
            // Sniper
            const receiver = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.15, 0.8), woodMat);
            const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 1.2), metalMat);
            barrel.rotation.x = Math.PI / 2;
            barrel.position.z = 0.8;
            const scope = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.4), metalMat);
            scope.rotation.x = Math.PI / 2;
            scope.position.set(0, 0.12, 0);
            const stock = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.2, 0.5), woodMat);
            stock.position.set(0, -0.05, -0.6);
            weaponGroup.add(receiver, barrel, scope, stock);

        } else if (type === 'shotgun') {
            // Shotgun
            const receiver = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.15, 0.6), metalMat);
            const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.8), metalMat);
            barrel.rotation.x = Math.PI / 2;
            barrel.position.z = 0.6;
            const pump = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.3), woodMat);
            pump.rotation.x = Math.PI / 2;
            pump.position.set(0, -0.06, 0.4);
            const stock = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.15, 0.4), woodMat);
            stock.position.set(0, -0.05, -0.4);
            weaponGroup.add(receiver, barrel, pump, stock);
        }

        return weaponGroup;
    }
};
