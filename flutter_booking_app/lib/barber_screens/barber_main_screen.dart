import 'package:flutter/material.dart';
import 'package:flutter_booking_app/core/theme/app_theme.dart';
import 'package:flutter/services.dart';

import 'barber_home_screen.dart';
import 'work_schedule_screen.dart';
import 'barber_history_screen.dart';
import 'barber_account_screen.dart';

class BarberMainScreen extends StatefulWidget {
  const BarberMainScreen({super.key});

  @override
  State<BarberMainScreen> createState() => _BarberMainScreenState();
}

class _BarberMainScreenState extends State<BarberMainScreen> {
  int _selectedIndex = 0;

  static const List<Widget> _screens = [
    BarberHomeScreen(),
    WorkScheduleScreen(),
    BarberHistoryScreen(),
    BarberAccountScreen(),
  ];

  @override
  Widget build(BuildContext context) {
    return AnnotatedRegion<SystemUiOverlayStyle>(
      value: SystemUiOverlayStyle.dark.copyWith(
        statusBarColor: const Color(0xffffc107),
      ),
      child: Scaffold(
        backgroundColor: const Color(0xffffc107),
        body: SafeArea(
          child: IndexedStack(index: _selectedIndex, children: _screens),
        ),
        bottomNavigationBar: Container(
          decoration: BoxDecoration(
            border: Border(
              top: BorderSide(color: AppTheme.borderColor, width: 0.5),
            ),
          ),
          child: BottomNavigationBar(
            type: BottomNavigationBarType.fixed,
            currentIndex: _selectedIndex,
            selectedItemColor: AppTheme.primaryDark,
            unselectedItemColor: const Color(0xFF9CA3AF),
            selectedLabelStyle: const TextStyle(
              fontSize: 11,
              fontWeight: FontWeight.w600,
            ),
            unselectedLabelStyle: const TextStyle(
              fontSize: 11,
              fontWeight: FontWeight.w400,
            ),
            selectedIconTheme: const IconThemeData(size: 26),
            unselectedIconTheme: const IconThemeData(size: 20),
            elevation: 0,
            onTap: (i) => setState(() => _selectedIndex = i),
            items: const [
              BottomNavigationBarItem(
                icon: Icon(Icons.home_outlined, size: 22),
                label: 'Trang chủ',
              ),
              BottomNavigationBarItem(
                icon: Icon(Icons.calendar_today_outlined, size: 22),
                label: 'Lịch làm việc',
              ),
              BottomNavigationBarItem(
                icon: Icon(Icons.history, size: 22),
                label: 'Lịch sử',
              ),
              BottomNavigationBarItem(
                icon: Icon(Icons.person_outline, size: 22),
                label: 'Tài khoản',
              ),
            ],
          ),
        ),
      ),
    );
  }
}
