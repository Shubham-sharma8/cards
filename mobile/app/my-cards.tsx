import React from 'react';
import { Redirect } from 'expo-router';

export default function MyCardsRedirectScreen() {
  return <Redirect href={'/(tabs)/my-cards' as never} />;
}
