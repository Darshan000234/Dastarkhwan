
import { io } from "socket.io-client";

const API_BASE_URL = (
  import.meta.env.VITE_API_BASE_URL ||
  "http://localhost:5000/api/v1"
).replace(/\/+$/, "");

const SOCKET_ORIGIN = API_BASE_URL.replace(/\/api\/v1$/i, "");

let socketInstance = null;
let activeUsers = 0;

function createSocket() {
  return io(SOCKET_ORIGIN, {
    autoConnect: false,
    withCredentials: true,
    transports: ["websocket", "polling"],
    reconnection: true,
    reconnectionAttempts: Infinity,
    reconnectionDelay: 1000,
    reconnectionDelayMax: 5000,
    timeout: 10000,
  });
}

function getSocket() {
  if (!socketInstance) {
    socketInstance = createSocket();
  }

  return socketInstance;
}

const socketClient = {
  connect() {
    const socket = getSocket();

    activeUsers += 1;

    if (!socket.connected && !socket.active) {
      socket.connect();
    }

    return socket;
  },

  disconnect() {
    activeUsers = Math.max(0, activeUsers - 1);

    // A provider should release its own reference.
    // Do not disconnect while another provider/page uses it.
    if (activeUsers === 0 && socketInstance) {
      socketInstance.disconnect();
      socketInstance = null;
    }
  },

  on(event, handler) {
    if (typeof handler !== "function") {
      throw new TypeError("Socket event handler must be a function.");
    }

    const socket = getSocket();
    socket.on(event, handler);

    return () => {
      socket.off(event, handler);
    };
  },

  once(event, handler) {
    const socket = getSocket();
    socket.once(event, handler);
  },

  off(event, handler) {
    if (!socketInstance) return;

    if (handler) {
      socketInstance.off(event, handler);
    } else {
      socketInstance.off(event);
    }
  },

  onReconnect(handler) {
    const socket = getSocket();

    const reconnectHandler = () => {
      handler();
    };

    socket.on("connect", reconnectHandler);

    return () => {
      socket.off("connect", reconnectHandler);
    };
  },

  get connected() {
    return Boolean(socketInstance?.connected);
  },

  get raw() {
    return socketInstance;
  },
};

export default socketClient;
