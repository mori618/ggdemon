export class NetworkManager {
    constructor() {
        this.peer = null;
        this.conn = null;
        this.myId = null;
        this.isHost = false;
        this.onDataCallback = null;
        this.onConnectCallback = null;
        this.onDisconnectCallback = null;
        this.onLogCallback = null;
    }

    log(msg) {
        console.log(`[NetworkManager] ${msg}`);
        if (this.onLogCallback) this.onLogCallback(msg);
    }

    init(isHost, onIdGenerated) {
        this.isHost = isHost;
        this.log(`Initializing as ${isHost ? 'HOST' : 'CLIENT'}...`);

        // Generate a simple, readable ID if host, otherwise let PeerJS gen one (we don't use it directly)
        // Note: PeerJS ID must be unique. We will use a random 6-char string for simplicity.
        const id = isHost ? this.generateRandomId() : undefined;

        this.peer = new Peer(id, {
            debug: 2
        });

        this.peer.on('open', (id) => {
            this.log('PeerJS server connection opened. My ID: ' + id);
            this.myId = id;
            if (onIdGenerated) onIdGenerated(id);
        });

        this.peer.on('connection', (conn) => {
            this.log(`Incoming connection from: ${conn.peer}`);
            // Only host accepts connections
            if (!this.isHost) {
                this.log('Closing: only HOST can accept connections');
                conn.close();
                return;
            }
            this.handleConnection(conn);
        });

        this.peer.on('error', (err) => {
            this.log(`<span class="text-rose-400">Error: ${err.type} - ${err.message}</span>`);
        });

        this.peer.on('disconnected', () => {
            this.log('Disconnected from PeerJS signaling server');
        });

        this.peer.on('close', () => {
            this.log('Peer destroyed');
        });
    }

    connect(hostId) {
        if (!this.peer) {
            this.log('Error: peer not initialized');
            return;
        }
        if (!this.peer.open) {
            this.log('Error: peer not ready (signaling server connection not open)');
            return;
        }
        this.log(`Attempting connection to HOST: ${hostId}...`);

        const conn = this.peer.connect(hostId, { reliable: true });
        if (!conn) {
            this.log('Error: failed to create connection object');
            return;
        }
        this.handleConnection(conn);
    }

    handleConnection(conn) {
        if (this.conn) {
            this.log('Already have a connection, ignoring new one');
            conn.close();
            return;
        }

        this.conn = conn;
        this.log(`Waiting for connection to open with ${conn.peer}...`);

        this.conn.on('open', () => {
            this.log(`<span class="text-emerald-400 font-bold">Successfully connected to: ${this.conn.peer}</span>`);
            if (this.onConnectCallback) this.onConnectCallback(this.conn.peer);
        });

        this.conn.on('data', (data) => {
            // Log data receipt silently in UI log unless critical, otherwise it floods
            // this.log(`Data received: ${data.type}`);
            if (this.onDataCallback) this.onDataCallback(data);
        });

        this.conn.on('close', () => {
            this.log('Connection closed by remote peer');
            this.conn = null;
            if (this.onDisconnectCallback) this.onDisconnectCallback();
        });

        this.conn.on('error', (err) => {
            this.log(`<span class="text-rose-400">Data Connection Error: ${err}</span>`);
        });
    }

    send(type, payload) {
        if (this.conn && this.conn.open) {
            this.conn.send({ type, payload });
        } else {
            this.log('Error: cannot send (connection not open)');
        }
    }

    generateRandomId() {
        const chars = 'abcdefghjkmnpqrstuvwxyz23456789'; // Remove confusing chars like l, 1, i, o, 0
        let result = 'gg-';
        for (let i = 0; i < 4; i++) {
            result += chars.charAt(Math.floor(Math.random() * chars.length));
        }
        return result;
    }

    // Callbacks setters
    setOnData(cb) { this.onDataCallback = cb; }
    setOnConnect(cb) { this.onConnectCallback = cb; }
    setOnDisconnect(cb) { this.onDisconnectCallback = cb; }
    setOnLog(cb) { this.onLogCallback = cb; }
}

export const network = new NetworkManager();
