import 'package:flutter/material.dart';

extension TextThemeCompat on TextTheme {
  TextStyle? get headline1 => displayLarge;
  TextStyle? get headline2 => headlineMedium ?? displayMedium;
  TextStyle? get headline3 => headlineSmall ?? titleLarge;
  TextStyle? get bodyText1 => bodyLarge;
  TextStyle? get caption => labelSmall ?? bodySmall;
}
