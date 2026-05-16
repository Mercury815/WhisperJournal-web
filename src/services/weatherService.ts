import { WeatherType } from '../lib/environment';

export async function fetchWeather(): Promise<WeatherType> {
  try {
    // Default location: San Francisco (Lat: 37.7749, Lon: -122.4194)
    // In a real app we'd request navigator.geolocation
    const response = await fetch('https://api.open-meteo.com/v1/forecast?latitude=37.7749&longitude=-122.4194&current_weather=true');
    if (!response.ok) return 'cloudy';
    
    const data = await response.json();
    const weatherCode = data.current_weather.weathercode;
    
    // Open-Meteo WMO weather codes
    // 0: clear sky
    // 1-3: mainly clear, partly cloudy, overcast
    // 45, 48: fog
    // 51-57: drizzle
    // 61-65: rain
    // 71-77: snow
    // 80-82: rain showers
    // 85-86: snow showers
    // 95-99: thunderstorm
    
    if (weatherCode === 0) return 'sunny';
    if (weatherCode <= 3) return 'cloudy';
    if (weatherCode >= 51 && weatherCode <= 65) return 'rain';
    if (weatherCode >= 71 && weatherCode <= 77) return 'snow';
    if (weatherCode >= 80 && weatherCode <= 82) return 'rain';
    if (weatherCode >= 85 && weatherCode <= 86) return 'snow';
    if (weatherCode >= 95) return 'rain'; // thunderstorm
    
    return 'cloudy';
  } catch (err) {
    return 'cloudy';
  }
}
