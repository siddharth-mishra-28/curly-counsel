// worker/durable_objects.js
class WebSocketHub {
  constructor(state, env) {
    this.state = state;
    this.env = env;
    this.clients = new Map(); // key -> WebSocket
  }

  async fetch(req) {
    // if it's an upgrade request (WebSocket)
    const url = new URL(req.url);
    if (req.headers.get('Upgrade') !== 'websocket') {
      // we accept simple POST messages to broadcast
      if (req.method === 'POST') {
        const body = await req.text();
        // broadcast to all connected clients
        for (const ws of this.clients.values()) {
          try { ws.send(body); } catch(e) {}
        }
        return new Response('ok');
      }
      return new Response('WSHub', {status:200});
    }

    const pair = new WebSocketPair();
    const [client, server] = Object.values(pair);
    server.accept();
    const id = crypto.randomUUID();
    this.clients.set(id, server);

    server.onmessage = (ev) => {
      // echo or ignore
    };
    server.onclose = () => { this.clients.delete(id) };
    return new Response(null, { status: 101, webSocket: client });
  }
}

export { WebSocketHub };
