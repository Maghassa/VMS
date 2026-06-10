module.exports = {
  apps: [
    {
      name: "vms-api",
      cwd: "./api",
      script: "dist/index.js",
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: "1G",
      env: { NODE_ENV: "production", PORT: 4000 },
      error_file: "./logs/api-error.log",
      out_file: "./logs/api-out.log",
      log_date_format: "YYYY-MM-DD HH:mm:ss",
    },
    {
      name: "vms-frontend",
      cwd: "./frontend",
      script: ".next/standalone/server.js",
      instances: 1,
      autorestart: true,
      watch: false,
      env: { NODE_ENV: "production", PORT: 3000 },
      error_file: "./logs/frontend-error.log",
      out_file: "./logs/frontend-out.log",
    },
  ],
};
