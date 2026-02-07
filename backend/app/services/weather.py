import json
from datetime import datetime, timezone
from typing import Dict, List
from urllib.error import URLError
from urllib.parse import urlencode
from urllib.request import urlopen

from app.models import PakistanWeatherResponse, ProvinceWeather


PROVINCE_COORDINATES = [
    ("Punjab", "Lahore", 31.5497, 74.3436),
    ("Sindh", "Karachi", 24.8607, 67.0011),
    ("Khyber Pakhtunkhwa", "Peshawar", 34.0151, 71.5249),
    ("Balochistan", "Quetta", 30.1798, 66.9750),
]


def _fetch_open_meteo(latitude: float, longitude: float) -> Dict[str, object]:
    query = urlencode(
        {
            "latitude": latitude,
            "longitude": longitude,
            "current": "temperature_2m,precipitation,wind_speed_10m",
            "hourly": "precipitation",
            "forecast_days": 1,
            "timezone": "auto",
        }
    )
    url = f"https://api.open-meteo.com/v1/forecast?{query}"
    with urlopen(url, timeout=10) as response:
        payload = response.read().decode("utf-8")
    return json.loads(payload)


def _to_weather_row(province: str, city: str, lat: float, lon: float, payload: Dict[str, object]) -> ProvinceWeather:
    current = payload.get("current", {})
    hourly = payload.get("hourly", {})
    hourly_precip = hourly.get("precipitation", []) if isinstance(hourly, dict) else []
    precip_sum = float(sum(hourly_precip)) if isinstance(hourly_precip, list) else 0.0

    drought_risk = max(0.0, min(1.0, 1.0 - (precip_sum / 12.0)))

    return ProvinceWeather(
        province=province,
        city=city,
        latitude=lat,
        longitude=lon,
        temperature_c=float(current.get("temperature_2m", 30.0)),
        precipitation_mm=float(current.get("precipitation", 0.0)),
        windspeed_kmh=float(current.get("wind_speed_10m", 0.0)),
        drought_risk=drought_risk,
    )


def _fallback_weather() -> List[ProvinceWeather]:
    fallback = []
    for province, city, lat, lon in PROVINCE_COORDINATES:
        fallback.append(
            ProvinceWeather(
                province=province,
                city=city,
                latitude=lat,
                longitude=lon,
                temperature_c=32.0,
                precipitation_mm=0.0,
                windspeed_kmh=10.0,
                drought_risk=0.75,
            )
        )
    return fallback


def get_pakistan_weather() -> PakistanWeatherResponse:
    rows: List[ProvinceWeather] = []
    source = "open-meteo"

    try:
        for province, city, lat, lon in PROVINCE_COORDINATES:
            payload = _fetch_open_meteo(lat, lon)
            rows.append(_to_weather_row(province, city, lat, lon, payload))
    except (URLError, TimeoutError, ValueError, KeyError):
        rows = _fallback_weather()
        source = "fallback"

    return PakistanWeatherResponse(
        source=source,
        timestamp_utc=datetime.now(timezone.utc).isoformat(),
        provinces=rows,
    )