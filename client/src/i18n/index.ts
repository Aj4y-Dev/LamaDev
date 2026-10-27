import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import * as Localization from 'expo-localization';
import AsyncStorage from '@react-native-async-storage/async-storage';
import en from './en.json';
import ne from './ne.json';

export type Language = 'en' | 'ne';
const KEY = 'app_language';
const device = Localization.getLocales()[0]?.languageCode;

void i18n.use(initReactI18next).init({
  resources: { en: { translation: en }, ne: { translation: ne } },
  lng: device === 'ne' ? 'ne' : 'en',
  fallbackLng: 'en',
  interpolation: { escapeValue: false },
  compatibilityJSON: 'v4',
});

export async function loadSavedLanguage(): Promise<void> {
  const saved = await AsyncStorage.getItem(KEY);
  if (saved === 'en' || saved === 'ne') await i18n.changeLanguage(saved);
}
export async function setLanguage(lang: Language): Promise<void> {
  await i18n.changeLanguage(lang);
  await AsyncStorage.setItem(KEY, lang);
}
export default i18n;
