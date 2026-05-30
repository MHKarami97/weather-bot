import {
  TelegramUpdate,
  TelegramMessage,
  TelegramCallbackQuery,
  sendTelegramMessage,
  editTelegramMessage,
  answerCallbackQuery,
  telegramApi,
  json,
  extractCity,
} from "./utils";
import { messages } from "./messages";
import { buildWeatherMessage } from "./weather";
import { checkMembership, getChannelInlineButtons, REQUIRED_CHANNELS } from "./channels";

interface Env {
  TELEGRAM_BOT_TOKEN: string;
  TELEGRAM_WEBHOOK_SECRET?: string;
  ADMIN_TOKEN?: string;
  BOT_NAME?: string;
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    if (request.method === "GET" && (url.pathname === "/" || url.pathname === "/health")) {
      return json({ ok: true, service: env.BOT_NAME ?? "weather-bot" });
    }

    if (url.pathname === "/set-webhook") {
      return handleSetWebhook(request, env, url);
    }

    if (url.pathname === "/delete-webhook") {
      return handleDeleteWebhook(request, env);
    }

    if (url.pathname === "/webhook") {
      return handleWebhook(request, env);
    }

    return new Response("Not found", { status: 404 });
  }
};

async function handleWebhook(request: Request, env: Env): Promise<Response> {
  if (request.method !== "POST") {
    return new Response("Method not allowed", {
      status: 405,
      headers: { Allow: "POST" }
    });
  }

  if (env.TELEGRAM_WEBHOOK_SECRET) {
    const secret = request.headers.get("X-Telegram-Bot-Api-Secret-Token");
    if (secret !== env.TELEGRAM_WEBHOOK_SECRET) {
      return new Response("Unauthorized", { status: 401 });
    }
  }

  let update: TelegramUpdate;
  try {
    update = (await request.json()) as TelegramUpdate;
  } catch {
    return new Response("Bad request", { status: 400 });
  }

  // Handle callback queries (inline button clicks)
  if (update.callback_query) {
    await handleCallbackQuery(update.callback_query, env);
    return new Response("ok");
  }

  // Handle regular messages
  const message = update.message ?? update.edited_message;
  if (!message?.text || message.from?.is_bot) {
    return new Response("ok");
  }

  const userId = message.from!.id;
  const chatId = message.chat.id;
  const text = message.text.trim();

  // Check channel membership
  const isMember = await checkMembership(userId, env.TELEGRAM_BOT_TOKEN);
  if (!isMember) {
    const channelButtons = getChannelInlineButtons();
    channelButtons.push([
      {
        text: messages.checkButton,
        callback_data: "check_membership"
      }
    ]);

    await sendTelegramMessage(env.TELEGRAM_BOT_TOKEN, chatId, messages.notMemberText, {
      inline_keyboard: channelButtons
    });
    return new Response("ok");
  }

  // Handle /start and /help commands
  if (/^\/(start|help)(?:@\w+)?$/i.test(text)) {
    await sendTelegramMessage(env.TELEGRAM_BOT_TOKEN, chatId, messages.start);
    return new Response("ok");
  }

  // Extract city name
  const city = extractCity(text);
  if (!city) {
    await sendTelegramMessage(env.TELEGRAM_BOT_TOKEN, chatId, messages.cityEmpty);
    return new Response("ok");
  }

  // Get and send weather
  try {
    const reply = await buildWeatherMessage(city);
    await sendTelegramMessage(env.TELEGRAM_BOT_TOKEN, chatId, reply);
  } catch (error) {
    let errorMsg = messages.weatherError;

    if (error instanceof Error) {
      const errorText = error.message;
      if (errorText.startsWith("cityNotFound:")) {
        const failCity = errorText.replace("cityNotFound:", "");
        errorMsg = messages.cityNotFound(failCity);
      } else if (errorText === "searchError") {
        errorMsg = messages.searchError;
      }
    }

    await sendTelegramMessage(env.TELEGRAM_BOT_TOKEN, chatId, errorMsg);
  }

  return new Response("ok");
}

async function handleCallbackQuery(query: TelegramCallbackQuery, env: Env): Promise<void> {
  const callbackId = query.id;
  const userId = query.from.id;
  const chatId = query.message?.chat.id;
  const messageId = query.message?.message_id;

  if (query.data === "check_membership") {
    const isMember = await checkMembership(userId, env.TELEGRAM_BOT_TOKEN);

    if (isMember) {
      await answerCallbackQuery(env.TELEGRAM_BOT_TOKEN, callbackId, messages.channelJoined);
      if (chatId && messageId) {
        await editTelegramMessage(
          env.TELEGRAM_BOT_TOKEN,
          chatId,
          messageId,
          messages.channelJoined
        );
      }
    } else {
      await answerCallbackQuery(env.TELEGRAM_BOT_TOKEN, callbackId, messages.stillNotMember);
    }
  }
}

async function handleSetWebhook(request: Request, env: Env, url: URL): Promise<Response> {
  if (request.method !== "POST") {
    return new Response("Method not allowed", {
      status: 405,
      headers: { Allow: "POST" }
    });
  }

  if (!authorizeAdmin(request, env)) {
    return new Response("Unauthorized", { status: 401 });
  }

  const webhookUrl = new URL("/webhook", url.origin).toString();
  const payload: Record<string, unknown> = {
    url: webhookUrl,
    drop_pending_updates: true
  };

  if (env.TELEGRAM_WEBHOOK_SECRET) {
    payload.secret_token = env.TELEGRAM_WEBHOOK_SECRET;
  }

  const result = await telegramApi<true>(env.TELEGRAM_BOT_TOKEN, "setWebhook", payload);
  return json({ ok: true, webhookUrl, telegram: result.result });
}

async function handleDeleteWebhook(request: Request, env: Env): Promise<Response> {
  if (request.method !== "POST") {
    return new Response("Method not allowed", {
      status: 405,
      headers: { Allow: "POST" }
    });
  }

  if (!authorizeAdmin(request, env)) {
    return new Response("Unauthorized", { status: 401 });
  }

  const result = await telegramApi<true>(env.TELEGRAM_BOT_TOKEN, "deleteWebhook", {
    drop_pending_updates: true
  });
  return json({ ok: true, telegram: result.result });
}

function authorizeAdmin(request: Request, env: Env): boolean {
  if (!env.ADMIN_TOKEN) {
    return false;
  }

  const authHeader = request.headers.get("Authorization");
  if (authHeader === `Bearer ${env.ADMIN_TOKEN}`) {
    return true;
  }

  const url = new URL(request.url);
  return url.searchParams.get("token") === env.ADMIN_TOKEN;
}




