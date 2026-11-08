// Runs once when the server starts. Starts the push alert sender, which does nothing unless VAPID keys are set.
export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  const { startPushSender } = await import("./lib/server/push");
  startPushSender();
}
