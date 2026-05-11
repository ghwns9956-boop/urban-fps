class UIManager {
    constructor() {
        this.healthText = document.getElementById('health-text');
        this.healthBar = document.getElementById('health-bar');
        this.ammoText = document.getElementById('ammo-text');
        this.weaponName = document.getElementById('weapon-name');
        
        this.hitMarker = document.getElementById('hit-marker');
        this.damageOverlay = document.getElementById('damage-overlay');
        
        this.killLogTable = document.getElementById('kill-log-body');
        this.killLogContainer = document.getElementById('kill-log-container');
        
        this.respawnScreen = document.getElementById('respawn-screen');
        this.respawnTimerContainer = document.getElementById('respawn-timer-container');
        this.respawnProgress = document.getElementById('respawn-progress');
        this.weaponSelect = document.getElementById('weapon-select');
        
        this.blocker = document.getElementById('blocker');
        this.instructions = document.getElementById('instructions');
    }

    updateHealth(health) {
        this.healthText.innerText = Math.max(0, Math.floor(health));
        this.healthBar.style.width = Math.max(0, health) + '%';
        
        if (health < 30) {
            this.healthBar.style.background = '#ff0000';
        } else {
            this.healthBar.style.background = '#00ff00';
        }
    }

    updateAmmo(current, max, weaponName) {
        if (current === 'RELOADING') {
            this.ammoText.innerText = 'RELOADING...';
            this.ammoText.style.color = '#ffaa00';
        } else {
            this.ammoText.innerText = `${current} / ${max}`;
            this.ammoText.style.color = '#ffffff';
        }
        this.weaponName.innerText = weaponName;
    }

    showHitMarker(isHeadshot) {
        this.hitMarker.style.display = 'block';
        this.hitMarker.style.borderColor = isHeadshot ? 'red' : 'white';
        // Reset animation
        this.hitMarker.style.animation = 'none';
        this.hitMarker.offsetHeight; // trigger reflow
        this.hitMarker.style.animation = null;
        
        setTimeout(() => {
            this.hitMarker.style.display = 'none';
        }, 200);
    }

    showDamage() {
        this.damageOverlay.style.opacity = 1;
        setTimeout(() => {
            this.damageOverlay.style.opacity = 0;
        }, 300);
    }

    addKillLog(killerName, weapon, victimName, isHeadshot) {
        const row = document.createElement('tr');
        row.innerHTML = `
            <td style="color: #44ff44">${killerName}</td>
            <td style="color: #aaaaaa">[${weapon}] ${isHeadshot ? '💥' : ''}</td>
            <td style="color: #ff4444">${victimName}</td>
        `;
        this.killLogTable.prepend(row);
        
        // Keep only last 5
        if (this.killLogTable.children.length > 5) {
            this.killLogTable.removeChild(this.killLogTable.lastChild);
        }
    }

    toggleKillLog(show) {
        this.killLogContainer.style.display = show ? 'block' : 'none';
    }

    showRespawnScreen() {
        document.exitPointerLock();
        this.blocker.style.display = 'none';
        this.respawnScreen.style.display = 'flex';
        this.respawnTimerContainer.style.display = 'block';
        this.weaponSelect.style.display = 'none';
        this.respawnProgress.style.width = '0%';

        let progress = 0;
        const interval = setInterval(() => {
            progress += 5; // 2 seconds total = 2000ms. 5% every 100ms
            this.respawnProgress.style.width = progress + '%';
            if (progress >= 100) {
                clearInterval(interval);
                this.respawnTimerContainer.style.display = 'none';
                this.weaponSelect.style.display = 'block';
            }
        }, 100);
    }

    hideRespawnScreen() {
        this.respawnScreen.style.display = 'none';
        this.blocker.style.display = 'flex';
    }
}
