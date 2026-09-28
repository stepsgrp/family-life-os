// Open-Meteo: free, no API key required.
interface OpenMeteoDaily {
  daily?: {
    time: string[];
    weather_code: number[];
    temperature_2m_max: number[];
    temperature_2m_min: number[];
    precipitation_probability_max: number[];
  };
}

const WMO: Record<number, string> = {
  0: "clear",
  1: "mostly clear",
  2: "partly cloudy",
  3: "overcast",
  45: "fog",
  51: "light drizzle",
  61: "light rain",
  63: "rain",
  65: "heavy rain",
  71: "light snow",
  73: "snow",
  80: "rain showers",
  95: "thunderstorm",
};

export async function getDailyForecast(lat: number, lng: number, startDate: string, endDate: string) {
  const url = new URL("https://api.open-meteo.com/v1/forecast");
  url.search = new URLSearchParams({
    latitude: String(lat),
    longitude: String(lng),
    daily: "weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max",
    timezone: "auto",
    start_date: startDate,
    end_date: endDate,
  }).toString();

  const res = await fetch(url);
  if (!res.ok) throw new Error(`Open-Meteo ${res.status}`);
  const { daily } = (await res.json()) as OpenMeteoDaily;
  if (!daily) return [];

  return daily.time.map((date, i) => ({
    date,
    conditions: WMO[daily.weather_code[i] ?? -1] ?? "mixed",
    highC: daily.temperature_2m_max[i],
    lowC: daily.temperature_2m_min[i],
    precipitationChancePct: daily.precipitation_probability_max[i],
  }));
}
