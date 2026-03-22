module.exports = {
  apps: [
    {
      name: 'yoontube-backend',
      cwd: '/opt/yoontube/backend',
      script: 'npm',
      args: 'run start',
      env: {
        NODE_ENV: 'production',
        PORT: 4000,
      },
    },
  ],
}
