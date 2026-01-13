export class NetworkManager {
    constructor() {
        this.peer = null;
        this.conn = null;
        this.myId = null;
        this.isHost = false;
        this.onDataCallback = null;
        this.onConnectCallback = null;
        this.onDisconnectCallback = null;
    }

    init(isHost, onIdGenerated) {
        this.isHost = isHost;
        // Generate a simple, readable ID if host, otherwise let PeerJS gen one (we don't use it directly)
        // Note: PeerJS ID must be unique. We will use a random 6-char string for simplicity.
        const id = isHost ? this.generateRandomId() : undefined;

        this.peer = new Peer(id, {
            debug: 2
        });

        this.peer.on('open', (id) => {
            console.log('My peer ID is: ' + id);
            this.myId = id;
            if (onIdGenerated) onIdGenerated(id);
        });

        this.peer.on('connection', (conn) => {
            // Only host accepts connections
            if (!this.isHost) {
                conn.close();
                return;
            }
            this.handleConnection(conn);
        });

        this.peer.on('error', (err) => {
            console.error('PeerJS Error:', err);
            // Optionally notify UI
        });
    }

    connect(hostId) {
        if (!this.peer) return;
        console.log('Connecting to ' + hostId);
        const conn = this.peer.connect(hostId);
        this.handleConnection(conn);
    }

    handleConnection(conn) {
        if (this.conn) {
            console.warn('Already connected, closing new connection');
            conn.close();
            return;
        }

        this.conn = conn;

        this.conn.on('open', () => {
            console.log('Connected to: ' + this.conn.peer);
            if (this.onConnectCallback) this.onConnectCallback(this.conn.peer);
        });

        this.conn.on('data', (data) => {
            console.log('Received:', data);
            if (this.onDataCallback) this.onDataCallback(data);
        });

        this.conn.on('close', () => {
            console.log('Connection closed');
            this.conn = null;
            if (this.onDisconnectCallback) this.onDisconnectCallback();
        });

        this.conn.on('error', (err) => {
            console.error('Connection error:', err);
        });
    }

    send(type, payload) {
        if (this.conn && this.conn.open) {
            this.conn.send({ type, payload });
        } else {
            console.warn('Cannot send, connection not open');
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
}

export const network = new NetworkManager();
