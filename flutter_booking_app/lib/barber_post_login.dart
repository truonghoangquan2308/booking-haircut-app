import 'package:flutter/material.dart';

import 'barber_screens/barber_main_screen.dart';
import 'screens/home_screen.dart';

/// Sau khi đăng nhập (OTP hoặc số đã có trong DB), chọn màn hình theo vai trò.
Widget homeAfterLogin(String role) {
  if (role == 'barber') return const BarberMainScreen();
  return const HomeScreen();
}
