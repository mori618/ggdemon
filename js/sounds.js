export class SoundManager {
    constructor() {
        this.ctx = null;
        this.isMuted = true;
        this.masterGain = null;
        this.volume = 0.5;
    }

    init() {
        if (this.ctx) return;
        this.ctx = new (window.AudioContext || window.webkitAudioContext)();
        this.masterGain = this.ctx.createGain();
        this.masterGain.connect(this.ctx.destination);
        this.updateGain();
    }

    updateGain() {
        if (this.masterGain) {
            const targetGain = this.isMuted ? 0 : this.volume;
            this.masterGain.gain.setTargetAtTime(targetGain, this.ctx.currentTime, 0.05);
        }
    }

    setVolume(v) {
        this.volume = v;
        this.updateGain();
    }

    unmute() {
        this.isMuted = false;
        if (!this.ctx) this.init();
        if (this.ctx.state === 'suspended') this.ctx.resume();
        this.updateGain();
    }

    mute() {
        this.isMuted = true;
        this.updateGain();
    }

    playSE(type) {
        if (this.isMuted || !this.ctx) return;
        const c = this.ctx;
        const now = c.currentTime;
        if (type === 'click') {
            const o = c.createOscillator();
            const g = c.createGain();
            o.connect(g);
            g.connect(this.masterGain);
            o.type = 'sine';
            o.frequency.setValueAtTime(450, now);
            g.gain.setValueAtTime(0, now);
            g.gain.linearRampToValueAtTime(0.12, now + 0.02);
            g.gain.exponentialRampToValueAtTime(0.001, now + 0.2);
            o.start();
            o.stop(now + 0.2);
        } else if (type === 'ready') {
            const o = c.createOscillator();
            const g = c.createGain();
            o.connect(g);
            g.connect(this.masterGain);
            o.type = 'sine';
            o.frequency.setValueAtTime(300, now);
            o.frequency.exponentialRampToValueAtTime(600, now + 0.3);
            g.gain.setValueAtTime(0.1, now);
            g.gain.linearRampToValueAtTime(0, now + 0.3);
            o.start();
            o.stop(now + 0.3);
        } else if (type === 'victory') {
            [523, 659, 783].forEach((f, i) => {
                const o = c.createOscillator();
                const g = c.createGain();
                o.connect(g);
                g.connect(this.masterGain);
                o.type = 'sine';
                o.frequency.setValueAtTime(f, now + i * 0.12);
                g.gain.setValueAtTime(0, now + i * 0.12);
                g.gain.linearRampToValueAtTime(0.1, now + i * 0.1 + 0.05);
                g.gain.linearRampToValueAtTime(0, now + i * 0.1 + 0.6);
                o.start(now + i * 0.1);
                o.stop(now + i * 0.1 + 0.6);
            });
        } else if (type === 'defeat') {
            const o = c.createOscillator();
            const g = c.createGain();
            o.connect(g);
            g.connect(this.masterGain);
            o.type = 'sine';
            o.frequency.setValueAtTime(200, now);
            o.frequency.exponentialRampToValueAtTime(40, now + 1.2);
            g.gain.setValueAtTime(0.2, now);
            g.gain.linearRampToValueAtTime(0, now + 1.2);
            o.start();
            o.stop(now + 1.2);
        } else if (type === 'charge') {
            const o = c.createOscillator();
            const g = c.createGain();
            o.connect(g);
            g.connect(this.masterGain);
            o.frequency.setValueAtTime(120, now);
            g.gain.setValueAtTime(0.2, now);
            g.gain.exponentialRampToValueAtTime(0.01, now + 0.3);
            o.start();
            o.stop(now + 0.3);
        } else if (type === 'attack') {
            const o = c.createOscillator();
            const g = c.createGain();
            o.connect(g);
            g.connect(this.masterGain);
            o.type = 'sawtooth';
            o.frequency.setValueAtTime(100, now);
            o.frequency.exponentialRampToValueAtTime(10, now + 0.2);
            g.gain.setValueAtTime(0.1, now);
            g.gain.exponentialRampToValueAtTime(0.01, now + 0.2);
            o.start();
            o.stop(now + 0.2);
        } else if (type === 'guard') {
            const o = c.createOscillator();
            const g = c.createGain();
            o.connect(g);
            g.connect(this.masterGain);
            o.type = 'square';
            o.frequency.setValueAtTime(150, now);
            g.gain.setValueAtTime(0.1, now);
            g.gain.exponentialRampToValueAtTime(0.01, now + 0.1);
            o.start();
            o.stop(now + 0.1);
        } else if (type === 'clash') {
            const o = c.createOscillator();
            const g = c.createGain();
            o.connect(g);
            g.connect(this.masterGain);
            o.type = 'triangle';
            o.frequency.setValueAtTime(200, now);
            o.frequency.exponentialRampToValueAtTime(1000, now + 0.05);
            g.gain.setValueAtTime(0.1, now);
            g.gain.linearRampToValueAtTime(0, now + 0.05);
            o.start();
            o.stop(now + 0.05);
        } else {
            const o = c.createOscillator();
            const g = c.createGain();
            o.connect(g);
            g.connect(this.masterGain);
            o.frequency.setValueAtTime(120, now);
            g.gain.setValueAtTime(0.2, now);
            g.gain.exponentialRampToValueAtTime(0.01, now + 0.3);
            o.start();
            o.stop(now + 0.3);
        }
    }
}

export const sound = new SoundManager();
