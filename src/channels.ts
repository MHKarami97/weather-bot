// بررسی عضویت کاربر در کانال‌های الزامی

interface Env {
  TELEGRAM_BOT_TOKEN: string;
}

export const REQUIRED_CHANNELS = ["@mhkarami_97"];

export async function checkMembership(userId: number, botToken: string): Promise<boolean> {
  for (const channel of REQUIRED_CHANNELS) {
    const isMember = await checkChannelMembership(userId, channel, botToken);
    if (!isMember) {
      return false;
    }
  }
  return true;
}

async function checkChannelMembership(userId: number, channel: string, botToken: string): Promise<boolean> {
  try {
    const response = await fetch(`https://api.telegram.org/bot${botToken}/getChatMember`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        chat_id: channel,
        user_id: userId
      })
    });

    const data = (await response.json()) as { ok: boolean; result?: { status: string } };
    if (!data.ok || !data.result) {
      return false;
    }

    const status = data.result.status;
    return status === "member" || status === "administrator" || status === "creator";
  } catch {
    return false;
  }
}

export function getChannelInlineButtons() {
  return REQUIRED_CHANNELS.map((channel) => [
    {
      text: `🔗 ${channel}`,
      url: `https://t.me/${channel.replace("@", "")}`
    }
  ]);
}

