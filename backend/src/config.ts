import { z } from 'zod'

const envSchema = z.object({
  PORT: z.coerce.number().int().min(1).max(65535).default(4000),
  DRIVE_ROOT_FOLDER_ID: z.string().min(1),
  SHARED_PASSWORD: z.string().min(1),
  GOOGLE_CLIENT_EMAIL: z.string().email(),
  GOOGLE_PRIVATE_KEY: z.string().min(1).transform((value) => value.replace(/\\n/g, '\n')),
})

type EnvInput = Record<string, string | undefined>

export function loadConfig(env: EnvInput) {
  const parsed = envSchema.parse(env)

  return {
    port: parsed.PORT,
    driveRootFolderId: parsed.DRIVE_ROOT_FOLDER_ID,
    sharedPassword: parsed.SHARED_PASSWORD,
    googleClientEmail: parsed.GOOGLE_CLIENT_EMAIL,
    googlePrivateKey: parsed.GOOGLE_PRIVATE_KEY,
  }
}
