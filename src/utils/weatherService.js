// Weather Service: Free Open-Meteo API integration & WMO Code Translator
// Defaults to 'rain' for today as requested

const WEATHER_KEY = 'my3dcube_weather_override';

export const WEATHER_CONDITIONS = {
  RAIN: 'rain',
  SNOW: 'snow',
  CLOUDY: 'cloudy',
  CLEAR: 'clear',
  AUTO: 'auto'
};

// Maps WMO Weather interpretation codes (WW) to our visual conditions
// https://open-meteo.com/en/docs
export function mapWmoCodeToCondition(wmoCode) {
  if (wmoCode === 0) return WEATHER_CONDITIONS.CLEAR;
  if ([1, 2, 3, 45, 48].includes(wmoCode)) return WEATHER_CONDITIONS.CLOUDY;
  if (
    [51, 53, 55, 56, 57, 61, 63, 65, 66, 67, 80, 81, 82, 95, 96, 99].includes(
      wmoCode
    )
  ) {
    return WEATHER_CONDITIONS.RAIN;
  }
  if ([71, 73, 75, 77, 85, 86].includes(wmoCode)) return WEATHER_CONDITIONS.SNOW;
  return WEATHER_CONDITIONS.RAIN; // Safe fallback
}

export function getStoredWeatherSetting() {
  try {
    const stored = localStorage.getItem(WEATHER_KEY);
    if (stored && Object.values(WEATHER_CONDITIONS).includes(stored)) {
      return stored;
    }
  } catch (e) {}
  // Default to rain per user request
  return WEATHER_CONDITIONS.RAIN;
}

export function setStoredWeatherSetting(setting) {
  try {
    localStorage.setItem(WEATHER_KEY, setting);
  } catch (e) {}
}

export async function fetchLiveWeather() {
  // If user forced a specific weather override (and it's not auto), return it
  const setting = getStoredWeatherSetting();
  if (setting !== WEATHER_CONDITIONS.AUTO && setting) {
    return {
      condition: setting,
      isAuto: false,
      description: setting.toUpperCase(),
      temp: null
    };
  }

  try {
    // Try browser geolocation first
    const coords = await new Promise((resolve) => {
      if (!navigator.geolocation) return resolve(null);
      navigator.geolocation.getCurrentPosition(
        (pos) =>
          resolve({
            lat: pos.coords.latitude,
            lon: pos.coords.longitude
          }),
        () => resolve(null),
        { timeout: 4000 }
      );
    });

    let lat = coords?.lat;
    let lon = coords?.lon;

    // Fallback: IP-based geolocation if browser geo blocked
    if (lat === undefined || lon === undefined) {
      try {
        const ipRes = await fetch('https://ipapi.co/json/');
        if (ipRes.ok) {
          const ipData = await ipRes.json();
          lat = ipData.latitude;
          lon = ipData.longitude;
        }
      } catch (e) {}
    }

    // Default to Mountain Time / Denver if no geo
    if (lat === undefined || lon === undefined) {
      lat = 39.7392;
      lon = -104.9903;
    }

    // Fetch from Open-Meteo
    const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=weather_code,temperature_2m,rain,snowfall,cloud_cover`;
    const res = await fetch(url);
    if (!res.ok) throw new Error('Open-Meteo API response not ok');
    const data = await res.json();
    const current = data.current;

    let condition = mapWmoCodeToCondition(current.weather_code);
    if (current.rain > 0.1) condition = WEATHER_CONDITIONS.RAIN;
    if (current.snowfall > 0.1) condition = WEATHER_CONDITIONS.SNOW;

    return {
      condition,
      isAuto: true,
      description: `WMO ${current.weather_code}`,
      temp: Math.round(current.temperature_2m)
    };
  } catch (err) {
    console.warn('Weather fetch error, using default rain:', err);
    return {
      condition: WEATHER_CONDITIONS.RAIN,
      isAuto: false,
      description: 'RAIN',
      temp: null
    };
  }
}
