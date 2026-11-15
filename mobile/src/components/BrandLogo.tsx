import React from 'react';
import Svg, { Path, Rect } from 'react-native-svg';

export function BrandLogoMark({ size = 28 }: { size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 36 36" fill="none">
      <Rect width="36" height="36" rx="9" fill="#0F5C4D" />
      <Rect
        x="7"
        y="10"
        width="22"
        height="16"
        rx="2.5"
        stroke="#FFFFFF"
        strokeWidth="1.6"
      />
      <Path d="M7 15.5H29" stroke="#FFFFFF" strokeWidth="1.6" />
      <Path
        d="M11 20.5H16.5"
        stroke="#FFFFFF"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
      <Rect x="21" y="19" width="4" height="3" rx="0.8" fill="#FFFFFF" />
    </Svg>
  );
}
