import 'package:flutter/material.dart';
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
          child: IndexedStack(
            index: _selectedIndex,
            children: _screens,
          ),
        ),
        bottomNavigationBar: BottomNavigationBar(
          type: BottomNavigationBarType.fixed,
          currentIndex: _selectedIndex,
          selectedItemColor: const Color(0xffffc107),
          unselectedItemColor: Colors.grey,
          onTap: (i) => setState(() => _selectedIndex = i),
          items: const [
            BottomNavigationBarItem(
              icon: Icon(Icons.home_outlined),
              label: 'Trang chủ',
            ),
            BottomNavigationBarItem(
              icon: Icon(Icons.calendar_today_outlined),
              label: 'Lịch làm việc',
            ),
            BottomNavigationBarItem(
              icon: Icon(Icons.history),
              label: 'Lịch sử',
            ),
            BottomNavigationBarItem(
              icon: Icon(Icons.person_outline),
              label: 'Tài khoản',
            ),
          ],
        ),
      ),
    );
  }
}
