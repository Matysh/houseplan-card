import type { Lang } from './i18n/registry';

const copy = {
  en: {
    title: 'Weather', show: 'Show weather', source: 'Weather source', choose: 'Choose a weather source',
    no_source: 'Add a weather integration in Home Assistant to show the weather.',
    select_source: 'Choose a weather source in the panel settings.',
    deleted: 'Weather source removed. Choose another in the panel settings.',
    unavailable: 'Weather temporarily unavailable', removed: 'Source removed',
    feels: 'Feels like', wind: 'Wind', humidity: 'Humidity', today: 'Today', more: 'More about the weather',
    directions: ['north', 'northeast', 'east', 'southeast', 'south', 'southwest', 'west', 'northwest'],
    conditions: ['Clear night', 'Cloudy', 'Exceptional', 'Fog', 'Hail', 'Lightning', 'Thunderstorms', 'Partly cloudy', 'Pouring', 'Rainy', 'Snowy', 'Sleet', 'Sunny', 'Windy', 'Windy and cloudy'],
  },
  ru: {
    title: 'Погода', show: 'Показывать погоду', source: 'Источник погоды', choose: 'Выберите источник погоды',
    no_source: 'Добавьте погодную интеграцию в Home Assistant, чтобы показывать погоду.',
    select_source: 'Выберите источник погоды в настройках панели.',
    deleted: 'Источник погоды удалён. Выберите другой в настройках панели.',
    unavailable: 'Погода временно недоступна', removed: 'Источник удалён',
    feels: 'Ощущается', wind: 'Ветер', humidity: 'Влажность', today: 'Сегодня', more: 'Подробнее о погоде',
    directions: ['северный', 'северо-восточный', 'восточный', 'юго-восточный', 'южный', 'юго-западный', 'западный', 'северо-западный'],
    conditions: ['Ясная ночь', 'Облачно', 'Необычная погода', 'Туман', 'Град', 'Гроза', 'Гроза с дождём', 'Переменная облачность', 'Ливень', 'Дождь', 'Снег', 'Дождь со снегом', 'Солнечно', 'Ветрено', 'Ветрено и облачно'],
  },
  de: {
    title: 'Wetter', show: 'Wetter anzeigen', source: 'Wetterquelle', choose: 'Wetterquelle auswählen',
    no_source: 'Fügen Sie in Home Assistant eine Wetterintegration hinzu.',
    select_source: 'Wählen Sie in den Panel-Einstellungen eine Wetterquelle.',
    deleted: 'Wetterquelle entfernt. Wählen Sie in den Panel-Einstellungen eine andere.',
    unavailable: 'Wetter vorübergehend nicht verfügbar', removed: 'Quelle entfernt',
    feels: 'Gefühlt', wind: 'Wind', humidity: 'Luftfeuchtigkeit', today: 'Heute', more: 'Mehr zum Wetter',
    directions: ['Nord', 'Nordost', 'Ost', 'Südost', 'Süd', 'Südwest', 'West', 'Nordwest'],
    conditions: ['Klare Nacht', 'Bewölkt', 'Außergewöhnliches Wetter', 'Nebel', 'Hagel', 'Gewitter', 'Gewitter mit Regen', 'Teilweise bewölkt', 'Starkregen', 'Regen', 'Schnee', 'Schneeregen', 'Sonnig', 'Windig', 'Windig und bewölkt'],
  },
  fr: {
    title: 'Météo', show: 'Afficher la météo', source: 'Source météo', choose: 'Choisir une source météo',
    no_source: 'Ajoutez une intégration météo dans Home Assistant.',
    select_source: 'Choisissez une source météo dans les paramètres du panneau.',
    deleted: 'Source météo supprimée. Choisissez-en une autre dans les paramètres du panneau.',
    unavailable: 'Météo temporairement indisponible', removed: 'Source supprimée',
    feels: 'Ressenti', wind: 'Vent', humidity: 'Humidité', today: "Aujourd’hui", more: 'Détails de la météo',
    directions: ['nord', 'nord-est', 'est', 'sud-est', 'sud', 'sud-ouest', 'ouest', 'nord-ouest'],
    conditions: ['Nuit claire', 'Nuageux', 'Temps exceptionnel', 'Brouillard', 'Grêle', 'Orage', 'Orage et pluie', 'Partiellement nuageux', 'Forte pluie', 'Pluie', 'Neige', 'Pluie et neige', 'Ensoleillé', 'Venteux', 'Venteux et nuageux'],
  },
};
type Key = Exclude<keyof typeof copy.en, 'directions' | 'conditions'>;
const conditions = ['clear-night', 'cloudy', 'exceptional', 'fog', 'hail', 'lightning', 'lightning-rainy', 'partlycloudy', 'pouring', 'rainy', 'snowy', 'snowy-rainy', 'sunny', 'windy', 'windy-variant'];
export const weatherText = (lang: Lang, key: Key): string => (copy[lang] ?? copy.en)[key];
export const weatherWindText = (lang: Lang, index: number): string => (copy[lang] ?? copy.en).directions[index];
export const weatherConditionText = (lang: Lang, condition: string): string =>
  (copy[lang] ?? copy.en).conditions[conditions.indexOf(condition)] || condition;
