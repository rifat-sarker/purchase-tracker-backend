// PM2 cluster-mode config — single-VPS horizontal scaling path.
// `instances` defaults to using every CPU core ('max'); override with the
// PM2_INSTANCES env var to pin a specific count.
module.exports = {
  apps: [
    {
      name: 'gadget-tracker-api',
      script: './dist/server.js',
      exec_mode: 'cluster',
      instances: process.env.PM2_INSTANCES || 'max',
      env: {
        NODE_ENV: 'production',
      },
      max_memory_restart: '300M',
      autorestart: true,
      watch: false,
      kill_timeout: 10000, // give in-flight requests time to drain on restart
    },
  ],
};
