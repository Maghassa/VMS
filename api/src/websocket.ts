import { Server as HttpServer } from "http";
import { WebSocketServer, WebSocket } from "ws";
import jwt from "jsonwebtoken";
import { parse } from "url";

interface VMSClient {
  ws: WebSocket;
  userId: string;
}

const clients = new Set<VMSClient>();

export function createWebSocketServer(server: HttpServer) {
  const wss = new WebSocketServer({ server, path: "/ws" });

  wss.on("connection", (ws, req) => {
    const query = parse(req.url || "", true).query;
    const token = query.token as string;

    if (!token) {
      ws.close(1008, "Missing token");
      return;
    }

    let userId: string;
    try {
      const payload = jwt.verify(token, process.env.JWT_SECRET!) as { sub: string };
      userId = payload.sub;
    } catch {
      ws.close(1008, "Invalid token");
      return;
    }

    const client: VMSClient = { ws, userId };
    clients.add(client);

    ws.on("close", () => clients.delete(client));
    ws.on("error", () => clients.delete(client));
  });

  return wss;
}

export function broadcast(event: string, data: unknown) {
  const message = JSON.stringify({ event, data });
  for (const client of clients) {
    if (client.ws.readyState === WebSocket.OPEN) {
      client.ws.send(message);
    }
  }
}
