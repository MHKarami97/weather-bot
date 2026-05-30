// توابع کاربردی مشترک بات

export type TelegramUpdate = {
  update_id: number;
  message?: TelegramMessage;
  callback_query?: TelegramCallbackQuery;
  edited_message?: TelegramMessage;
};

export type TelegramMessage = {
  message_id: number;
  date: number;
  chat: {
    id: number;
    type: string;
    first_name?: string;
    last_name?: string;
    username?: string;
  };
  from?: {
    id: number;
    is_bot: boolean;
    first_name: string;
    last_name?: string;
    username?: string;
    language_code?: string;
  };
  text?: string;
};

export type TelegramCallbackQuery = {
  id: string;
  from: {
    id: number;
    is_bot: boolean;
    first_name: string;
    last_name?: string;
    username?: string;
    language_code?: string;
  };
  chat_instance: string;
  data?: string;
  message?: TelegramMessage;
};

export type TelegramApiResponse<T> = {
  ok: boolean;
  result?: T;
  description?: string;
};

export async function sendTelegramMessage(
  botToken: string,
  chatId: number,
  text: string,
  replyMarkup?: unknown
): Promise<void> {
  const payload: Record<string, unknown> = {
    chat_id: chatId,
    text,
    disable_web_page_preview: true
  };

  if (replyMarkup) {
    payload.reply_markup = replyMarkup;
  }

  await telegramApi(botToken, "sendMessage", payload);
}

export async function editTelegramMessage(
  botToken: string,
  chatId: number,
  messageId: number,
  text: string,
  replyMarkup?: unknown
): Promise<void> {
  const payload: Record<string, unknown> = {
    chat_id: chatId,
    message_id: messageId,
    text,
    disable_web_page_preview: true
  };

  if (replyMarkup) {
    payload.reply_markup = replyMarkup;
  }

  await telegramApi(botToken, "editMessageText", payload);
}

export async function answerCallbackQuery(botToken: string, callbackQueryId: string, text?: string): Promise<void> {
  const payload: Record<string, unknown> = {
    callback_query_id: callbackQueryId
  };

  if (text) {
    payload.text = text;
    payload.show_alert = false;
  }

  await telegramApi(botToken, "answerCallbackQuery", payload);
}

export async function telegramApi<T>(
  botToken: string,
  method: string,
  payload: Record<string, unknown>
): Promise<TelegramApiResponse<T>> {
  const response = await fetch(`https://api.telegram.org/bot${botToken}/${method}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(payload)
  });

  const data = (await response.json()) as TelegramApiResponse<T>;
  if (!response.ok || !data.ok) {
    throw new Error(data.description ?? `Telegram API error on ${method}`);
  }

  return data;
}

export function json(data: unknown, init?: ResponseInit): Response {
  const headers = new Headers(init?.headers);
  headers.set("content-type", "application/json; charset=utf-8");

  return new Response(JSON.stringify(data), {
    ...init,
    headers
  });
}

export function extractCity(text: string): string {
  const cleaned = text.replace(/^\/weather(?:@\w+)?\s*/i, "").trim();
  if (!cleaned || cleaned.startsWith("/")) {
    return "";
  }
  return cleaned;
}



