// تمام منطق دریافت و نمایش وضعیت هوا

import { weatherConditions, weatherLabels } from "./messages";

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

export async function buildWeatherMessage(city: string): Promise<string> {
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
    `${weatherLabels.location}: ${locationLabel}`,
    `${weatherLabels.condition}: ${condition}`
  ];

  if (typeof currentTemp === "number") {
    lines.push(`${weatherLabels.temperature}: ${round(currentTemp)}°C`);
  }

  if (typeof feelsLike === "number") {
    lines.push(`${weatherLabels.feelsLike}: ${round(feelsLike)}°C`);
  }

  if (typeof todayMin === "number" && typeof todayMax === "number") {
    lines.push(`${weatherLabels.range}: ${round(todayMin)}°C - ${round(todayMax)}°C`);
  }

  if (typeof humidity === "number") {
    lines.push(`${weatherLabels.humidity}: ${Math.round(humidity)}%`);
  }

  if (typeof wind === "number") {
    lines.push(`${weatherLabels.wind}: ${round(wind)} km/h`);
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
    throw new Error("searchError");
  }

  const data = (await response.json()) as GeocodingResponse;
  const results = data.results ?? [];
  if (results.length === 0) {
    throw new Error(`cityNotFound:${city}`);
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
    throw new Error("weatherError");
  }

  return (await response.json()) as ForecastResponse;
}

function weatherCodeToText(code?: number): string {
  if (typeof code !== "number") {
    return "weatherUnavailable";
  }

  return weatherConditions[code] ?? `weatherCodeUnknown:${code}`;
}

function round(value: number): string {
  return Number.isInteger(value) ? String(value) : value.toFixed(1);
}

