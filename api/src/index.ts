import "dotenv/config";
import app from "./app";
import { createWebSocketServer } from "./websocket";
import { startScheduledJobs } from "./jobs";
import { prisma } from "./db";
import http from "http";

const PORT = parseInt(process.env.PORT || "4000", 10);

const server = http.createServer(app);
createWebSocketServer(server);

server.listen(PORT, async () => {
  console.log(`VMS API running on port ${PORT}`);
  await prisma.$connect();
  startScheduledJobs();
});

process.on("SIGTERM", async () => {
  await prisma.$disconnect();
  server.close(() => process.exit(0));
});
