interface Env {
  TELEGRAM_BOT_TOKEN: string;
  TELEGRAM_WEBHOOK_SECRET?: string;
  ADMIN_TOKEN?: string;
  BOT_NAME?: string;
}

type TelegramUpdate = {
  update_id: number;
  message?: TelegramMessage;
  edited_message?: TelegramMessage;
};

type TelegramMessage = {
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

type GeocodingResult = {
  id: number;
  name: string;
  latitude: number;
  longitude: number;
  country?: string;
  admin1?: string;
  timezone?: string;
};

type GeocodingResponse = {
  results?: GeocodingResult[];
};

type ForecastResponse = {
  latitude: number;
  longitude: number;
  timezone?: string;
  current?: {
    time: string;
    interval?: number;
    temperature_2m?: number;
    apparent_temperature?: number;
    weather_code?: number;
    wind_speed_10m?: number;
    relative_humidity_2m?: number;
  };
  daily?: {
    time: string[];
    temperature_2m_max?: number[];
    temperature_2m_min?: number[];
    weather_code?: number[];
  };
};

type TelegramApiResponse<T> = {
  ok: boolean;
  result: T;
  description?: string;
};

const WEATHER_CODE_TEXT: Record<number, string> = {
  0: "Clear sky",
  1: "Mainly clear",
  2: "Partly cloudy",
  3: "Overcast",
  45: "Fog",
  48: "Depositing rime fog",
  51: "Light drizzle",
  53: "Moderate drizzle",
  55: "Dense drizzle",
  56: "Light freezing drizzle",
  57: "Dense freezing drizzle",
  61: "Slight rain",
  63: "Moderate rain",
  65: "Heavy rain",
  66: "Light freezing rain",
  67: "Heavy freezing rain",
  71: "Slight snow fall",
  73: "Moderate snow fall",
  75: "Heavy snow fall",
  77: "Snow grains",
  80: "Slight rain showers",
  81: "Moderate rain showers",
  82: "Violent rain showers",
  85: "Slight snow showers",
  86: "Heavy snow showers",
  95: "Thunderstorm",
  96: "Thunderstorm with slight hail",
  99: "Thunderstorm with heavy hail"
};

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

  const message = update.message ?? update.edited_message;
  if (!message?.text || message.from?.is_bot) {
    return new Response("ok");
  }

  const text = message.text.trim();
  const chatId = message.chat.id;

  if (/^\/(start|help)(?:@\w+)?$/i.test(text)) {
    await sendTelegramMessage(
      env,
      chatId,
      [
        "Send me a city name and I’ll reply with today’s weather.",
        "You can also use /weather <city>.",
        "Example: London"
      ].join("\n")
    );
    return new Response("ok");
  }

  const city = extractCity(text);
  if (!city) {
    await sendTelegramMessage(env, chatId, "Please send a city name.");
    return new Response("ok");
  }

  try {
    const reply = await buildWeatherMessage(city);
    await sendTelegramMessage(env, chatId, reply);
  } catch (error) {
    await sendTelegramMessage(env, chatId, error instanceof Error ? error.message : "Unable to get weather right now.");
  }

  return new Response("ok");
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

  const result = await telegramApi<true>(env, "setWebhook", payload);
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

  const result = await telegramApi<true>(env, "deleteWebhook", { drop_pending_updates: true });
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

function extractCity(text: string): string {
  const cleaned = text.replace(/^\/weather(?:@\w+)?\s*/i, "").trim();
  if (!cleaned || cleaned.startsWith("/")) {
    return "";
  }
  return cleaned;
}

async function buildWeatherMessage(city: string): Promise<string> {
  const location = await geocodeCity(city);
  const forecast = await getForecast(location.latitude, location.longitude);

  const daily = forecast.daily;
  const current = forecast.current;
  const todayMax = daily?.temperature_2m_max?.[0];
  const todayMin = daily?.temperature_2m_min?.[0];
  const todayCode = daily?.weather_code?.[0] ?? current?.weather_code;

  const locationLabel = [location.name, location.admin1, location.country].filter(Boolean).join(", ");
  const condition = weatherCodeToText(todayCode);
  const currentTemp = current?.temperature_2m;
  const feelsLike = current?.apparent_temperature;
  const humidity = current?.relative_humidity_2m;
  const wind = current?.wind_speed_10m;

  const lines = [
    `${locationLabel}`,
    `وضعیت امروز: ${condition}`
  ];

  if (typeof currentTemp === "number") {
    lines.push(`دما: ${round(currentTemp)}°C`);
  }

  if (typeof feelsLike === "number") {
    lines.push(`دمای احساسی: ${round(feelsLike)}°C`);
  }

  if (typeof todayMin === "number" && typeof todayMax === "number") {
    lines.push(`بازه دمایی امروز: ${round(todayMin)}°C - ${round(todayMax)}°C`);
  }

  if (typeof humidity === "number") {
    lines.push(`رطوبت: ${Math.round(humidity)}%`);
  }

  if (typeof wind === "number") {
    lines.push(`سرعت باد: ${round(wind)} km/h`);
  }

  return lines.join("\n");
}

async function geocodeCity(city: string): Promise<GeocodingResult> {
  const url = new URL("https://geocoding-api.open-meteo.com/v1/search");
  url.searchParams.set("name", city);
  url.searchParams.set("count", "5");
  url.searchParams.set("language", "en");
  url.searchParams.set("format", "json");

  const response = await fetch(url);
  if (!response.ok) {
    throw new Error("Unable to search that city right now.");
  }

  const data = (await response.json()) as GeocodingResponse;
  const results = data.results ?? [];
  if (results.length === 0) {
    throw new Error(`City not found: ${city}`);
  }

  const exact = results.find((item) => item.name.toLowerCase() === city.toLowerCase());
  return exact ?? results[0];
}

async function getForecast(latitude: number, longitude: number): Promise<ForecastResponse> {
  const url = new URL("https://api.open-meteo.com/v1/forecast");
  url.searchParams.set("latitude", String(latitude));
  url.searchParams.set("longitude", String(longitude));
  url.searchParams.set("current", "temperature_2m,apparent_temperature,relative_humidity_2m,wind_speed_10m,weather_code");
  url.searchParams.set("daily", "temperature_2m_max,temperature_2m_min,weather_code");
  url.searchParams.set("timezone", "auto");
  url.searchParams.set("forecast_days", "1");

  const response = await fetch(url);
  if (!response.ok) {
    throw new Error("Unable to get weather right now.");
  }

  return (await response.json()) as ForecastResponse;
}

async function sendTelegramMessage(env: Env, chatId: number, text: string): Promise<void> {
  await telegramApi(env, "sendMessage", {
    chat_id: chatId,
    text,
    disable_web_page_preview: true
  });
}

async function telegramApi<T>(env: Env, method: string, payload: Record<string, unknown>): Promise<TelegramApiResponse<T>> {
  const response = await fetch(`https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/${method}`, {
    method: "POST",
    headers: {
      "content-type": "application/json"
    },
    body: JSON.stringify(payload)
  });

  const data = (await response.json()) as TelegramApiResponse<T>;
  if (!response.ok || !data.ok) {
    throw new Error(data.description ?? `Telegram API error on ${method}`);
  }

  return data;
}

function weatherCodeToText(code?: number): string {
  if (typeof code !== "number") {
    return "Weather unavailable";
  }

  return WEATHER_CODE_TEXT[code] ?? `Weather code ${code}`;
}

function round(value: number): string {
  return Number.isInteger(value) ? String(value) : value.toFixed(1);
}

function json(data: unknown, init?: ResponseInit): Response {
  const headers = new Headers(init?.headers);
  headers.set("content-type", "application/json; charset=utf-8");

  return new Response(JSON.stringify(data), {
    ...init,
    headers
  });
}



