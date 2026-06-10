import cron from "node-cron";
import { runDailyScan } from "./dailyScan";
import { runCrmSync } from "./crmSync";
import { runAutoDismiss } from "./autoDismiss";
import { broadcast } from "../websocket";

export function startScheduledJobs() {
  // Daily photo scan at 2am
  cron.schedule("0 2 * * *", async () => {
    console.log("Running daily photo scan...");
    await runDailyScan();
  });

  // CRM sync every hour
  cron.schedule("0 * * * *", async () => {
    console.log("Running CRM sync...");
    await runCrmSync();
  });

  // Auto-dismiss check every 30 minutes
  cron.schedule("*/30 * * * *", async () => {
    await runAutoDismiss();
  });

  // Disk monitor every 5 minutes
  cron.schedule("*/5 * * * *", () => {
    // Placeholder: on Linux read /proc/mounts or use statvfs
    const warnPct = parseInt(process.env.DISK_WARNING_PCT || "70", 10);
    const critPct = parseInt(process.env.DISK_CRITICAL_PCT || "85", 10);
    // When real disk usage exceeds threshold, broadcast alert
    // broadcast("health_alert", { type: "disk", severity: "warning", message: "Disk usage at 72%" });
  });

  console.log("Scheduled jobs started");
}
