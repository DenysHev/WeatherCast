import { Component, OnInit, ChangeDetectionStrategy} from '@angular/core';
import {CommonModule} from '@angular/common';
import { HttpClientModule, HttpClient } from '@angular/common/http';
import { ChangeDetectorRef, NgZone } from '@angular/core';
import {fetchWeatherApi} from 'openmeteo';
import { FormsModule } from '@angular/forms';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [CommonModule, HttpClientModule, FormsModule],
  changeDetection: ChangeDetectionStrategy.Default,
  templateUrl: './app.html',
})
export class App implements OnInit {
  user: any = null;
  weatherData: any = null;
  weekSummary: { day: string; text: string; icon: string;dateStr: string}[] = [];
  dailySummary: {
    today: string;
    todayIcon: string;
    tomorrow: string;
    tomorrowIcon: string;
  } | null = null;


  constructor(private http: HttpClient, private cd: ChangeDetectorRef, private ngZone: NgZone) {}
  summarizeWeather(hourly: any): {
    today: string; todayIcon: string;
    tomorrow: string; tomorrowIcon: string;
  } {
    const today = new Date();
    const tomorrow = new Date();
    tomorrow.setDate(today.getDate() + 1);

    const summarizeDay = (day: Date) => {
      const dayStr = day.toDateString();

      const entries = hourly.time.map((t: Date, i: number): {
        date: Date;
        rain: number;
        cloud: number;
      } => ({
        date: new Date(t),
        rain: hourly.rain[i],
        cloud: (hourly.cloudCoverMid[i] + hourly.cloudCoverHigh[i]) / 2,
      })).filter((entry: { date: Date; rain: number; cloud: number }) =>
        entry.date.toDateString() === dayStr
      );

      const rainSum = entries.reduce((sum: number, e: { rain: number }) => sum + e.rain, 0);
      const avgCloud = entries.reduce((sum: number, e: { cloud: number }) => sum + e.cloud, 0) / entries.length;

      if (rainSum > 2) return { text: 'Злива', icon: 'assets/weather/heavy_rain.avif' };
      if (rainSum > 0.5) return { text: 'Дощ', icon: 'assets/weather/rain.png' };
      if (avgCloud > 70) return { text: 'Хмарно', icon: 'assets/weather/cloudly.png' };
      return { text: 'Ясно', icon: "assets/weather/sunny.png"};
    };

    const todaySummary = summarizeDay(today);
    const tomorrowSummary = summarizeDay(tomorrow);

    return {
      today: todaySummary.text,
      todayIcon: todaySummary.icon,
      tomorrow: tomorrowSummary.text,
      tomorrowIcon: tomorrowSummary.icon,
    };
  }
  summarizeWeekWeather(hourly: any): { day: string; dateStr: string; text: string; icon: string }[] {
    const result: { day: string; dateStr: string; text: string; icon: string }[] = [];
    const daysOfWeek = ['Нд', 'Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб'];

    for (let offset = 0; offset < 7; offset++) {
      const date = new Date();
      date.setHours(0, 0, 0, 0);
      date.setDate(date.getDate() + offset);
      const dateKey = date.toISOString().split('T')[0];

      const entries = hourly.time.map((t: Date, i: number): { date: Date; rain: number; cloud: number } => ({
        date: new Date(t),
        rain: hourly.rain[i],
        cloud: (hourly.cloudCoverMid[i] + hourly.cloudCoverHigh[i]) / 2,
      }));

      const filteredEntries = entries.filter((e: { date: Date; rain: number; cloud: number }) => {
        const d = new Date(e.date);
        d.setHours(0, 0, 0, 0);
        return d.toISOString().split('T')[0] === dateKey;
      });

      const rainSum = filteredEntries.reduce((sum: number, e: { rain: number }) => sum + e.rain, 0);
      const cloudAvg = filteredEntries.reduce((sum: number, e: { cloud: number }) => sum + e.cloud, 0) / filteredEntries.length;


      let text = '';
      let icon = '';

      if (rainSum > 2)        { text = 'Злива'; icon = 'assets/weather/heavy_rain.png'; }
      else if (rainSum > 0.5) { text = 'Дощ'; icon = 'assets/weather/rain.png'; }
      else if (cloudAvg > 70) { text = 'Хмарно'; icon = 'assets/weather/cloudly.png'; }
      else                    { text = 'Ясно'; icon = 'assets/weather/sunny.png'; }

      result.push({
        day: daysOfWeek[date.getDay()],
        dateStr: date.toLocaleDateString('uk-UA', { day: '2-digit', month: '2-digit' }),
        text,
        icon
      });
    }

    return result;
  }
  ngOnInit() {
    this.http.get<any>('https://randomuser.me/api/').subscribe(async res => {
      this.user = res.results[0];
      const params = {
        "latitude": this.user.location.coordinates.latitude,
        "longitude": this.user.location.coordinates.longitude,
        "hourly": ["temperature_2m", "rain", "cloud_cover_mid", "cloud_cover_high"]
      };

      const url = "https://api.open-meteo.com/v1/forecast";
      console.log(params);
      const responses = await fetchWeatherApi(url, params);
      const response = responses[0];
      const utcOffsetSeconds = response.utcOffsetSeconds();
      const hourly = response.hourly()!;

      const weatherData = {
        hourly: {
          time: [...Array((Number(hourly.timeEnd()) - Number(hourly.time())) / hourly.interval())].map(
            (_, i) => new Date((Number(hourly.time()) + i * hourly.interval() + utcOffsetSeconds) * 1000)
          ),
          temperature2m: hourly.variables(0)!.valuesArray()!,
          rain: hourly.variables(1)!.valuesArray()!,
          cloudCoverMid: hourly.variables(2)!.valuesArray()!,
          cloudCoverHigh: hourly.variables(3)!.valuesArray()!,
        },
      };
      this.dailySummary = this.summarizeWeather(weatherData.hourly);
      this.weatherData = weatherData;
      this.weekSummary = this.summarizeWeekWeather(weatherData.hourly);
      this.ngZone.run(() => {
        this.cd.detectChanges();
        console.log(weatherData);
      });
    });
  }

}
