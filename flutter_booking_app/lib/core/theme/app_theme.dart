import 'package:flutter/material.dart';

class AppTheme {
  // Colors
  static const Color primaryColor = Color(0xFFFFC107);
  static const Color primaryDark = Color(0xFFF59E0B);
  static const Color surfaceColor = Colors.white;
  static const Color backgroundColor = Color(0xFFF8F8F8);
  static const Color textPrimary = Color(0xFF1A1A1A);
  static const Color textSecondary = Color(0xFF6B7280);
  static const Color textHint = Color(0xFF9CA3AF);
  static const Color successColor = Color(0xFF10B981);
  static const Color warningColor = Color(0xFFF59E0B);
  static const Color borderColor = Color(0xFFE5E7EB);

  // Radii
  static final BorderRadius cardRadius = BorderRadius.circular(16);
  static final BorderRadius buttonRadius = BorderRadius.circular(12);

  // Font sizes
  static const double heading1 = 24;
  static const double heading2 = 18;
  static const double heading3 = 16;
  static const double body = 14;
  static const double caption = 12;

  // Font weights
  static const FontWeight semibold = FontWeight.w600;
  static const FontWeight medium = FontWeight.w500;
  static const FontWeight regular = FontWeight.w400;

  static ThemeData get themeData {
    final base = ThemeData.light();
    return base.copyWith(
      scaffoldBackgroundColor: backgroundColor,
      primaryColor: primaryColor,
      colorScheme: base.colorScheme.copyWith(
        primary: primaryColor,
        surface: surfaceColor,
      ),
      appBarTheme: const AppBarTheme(
        backgroundColor: Colors.white,
        elevation: 0,
        titleTextStyle: TextStyle(
          color: AppTheme.textPrimary,
          fontSize: 16,
          fontWeight: AppTheme.semibold,
        ),
        iconTheme: IconThemeData(color: AppTheme.textPrimary),
      ),
      textTheme: base.textTheme.copyWith(
        displayLarge: const TextStyle(
          fontSize: heading1,
          fontWeight: semibold,
          color: textPrimary,
        ),
        headlineMedium: const TextStyle(
          fontSize: heading2,
          fontWeight: semibold,
          color: textPrimary,
        ),
        headlineSmall: const TextStyle(
          fontSize: heading3,
          fontWeight: medium,
          color: textPrimary,
        ),
        bodyLarge: const TextStyle(
          fontSize: body,
          fontWeight: regular,
          color: textPrimary,
        ),
        labelSmall: const TextStyle(
          fontSize: caption,
          fontWeight: regular,
          color: textSecondary,
        ),
      ),
      bottomNavigationBarTheme: const BottomNavigationBarThemeData(
        type: BottomNavigationBarType.fixed,
        selectedItemColor: primaryColor,
        unselectedItemColor: Color(0xFF9CA3AF),
        selectedLabelStyle: TextStyle(
          fontSize: 11,
          fontWeight: FontWeight.w600,
        ),
        unselectedLabelStyle: TextStyle(
          fontSize: 11,
          fontWeight: FontWeight.w400,
        ),
        elevation: 0,
        showUnselectedLabels: true,
        selectedIconTheme: IconThemeData(size: 22),
        unselectedIconTheme: IconThemeData(size: 22),
      ),
      dividerColor: borderColor,
    );
  }
}
