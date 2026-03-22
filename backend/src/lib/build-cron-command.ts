const DEFAULT_BACKEND_DIR = '/opt/yoontube/backend'
const SYNC_COMMAND = 'npm run sync'

function quoteShellPath(path: string) {
  return `"${path.replace(/(["\\$`])/g, '\\$1')}"`
}

export function buildCronCommand(backendDir = DEFAULT_BACKEND_DIR) {
  return `cd ${quoteShellPath(backendDir)} && ${SYNC_COMMAND}`
}
