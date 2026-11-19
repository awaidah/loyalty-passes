import { env } from "cloudflare:workers";

/** Records a member the first time the app sees them. */
export async function ensureAppUser(user: { id: string; email: string }) {
  await env.DB.prepare(
    "INSERT INTO app_users (id, email) VALUES (?, ?) ON CONFLICT(id) DO UPDATE SET email = excluded.email WHERE app_users.email <> excluded.email",
  )
    .bind(user.id, user.email)
    .run();
}
