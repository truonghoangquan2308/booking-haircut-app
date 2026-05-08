// lib/screens/my_appointments_screen.dart
import 'package:flutter/material.dart';
import 'booking_screen.dart';

class MyAppointmentsScreen extends StatelessWidget {
  const MyAppointmentsScreen({super.key});

  final _appointments = const [
    {
      'date': '12 Tháng 3, 2026',
      'time': '10:00',
      'service': 'Cắt tóc nam',
      'barber': 'Hùng',
      'status': 'confirmed',
    },
    {
      'date': '20 Tháng 3, 2026',
      'time': '9:00',
      'service': 'Uốn tóc nam',
      'barber': 'Khang',
      'status': 'pending',
    },
  ];

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xfff4f5f9),
      appBar: AppBar(
        backgroundColor: const Color(0xffffc107),
        title: const Text(
          'Đặt Lịch Của Tôi',
          style: TextStyle(fontWeight: FontWeight.bold),
        ),
        foregroundColor: Colors.black,
        elevation: 0,
      ),
      body: _appointments.isEmpty
          ? _buildEmpty(context)
          : ListView.builder(
              padding: const EdgeInsets.all(16),
              itemCount: _appointments.length,
              itemBuilder: (context, i) => _buildCard(_appointments[i]),
            ),
      floatingActionButton: FloatingActionButton.extended(
        onPressed: () => Navigator.push(
          context,
          MaterialPageRoute(builder: (_) => const BookingScreen()),
        ),
        backgroundColor: const Color(0xffffc107),
        icon: const Icon(Icons.add, color: Colors.black),
        label: const Text(
          'Đặt lịch mới',
          style: TextStyle(color: Colors.black, fontWeight: FontWeight.bold),
        ),
      ),
    );
  }

  Widget _buildEmpty(BuildContext context) {
    return Center(
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          const Icon(Icons.calendar_today, size: 80, color: Color(0xffffc107)),
          const SizedBox(height: 16),
          const Text(
            'Bạn Chưa Có Lịch Hẹn Nào',
            style: TextStyle(fontWeight: FontWeight.bold, fontSize: 16),
          ),
          const SizedBox(height: 8),
          Text(
            'Hãy đặt lịch để cắt tóc ngay',
            style: TextStyle(color: Colors.grey.shade600),
          ),
          const SizedBox(height: 24),
          ElevatedButton(
            onPressed: () => Navigator.push(
              context,
              MaterialPageRoute(builder: (_) => const BookingScreen()),
            ),
            style: ElevatedButton.styleFrom(
              backgroundColor: const Color(0xffffc107),
              padding: const EdgeInsets.symmetric(horizontal: 32, vertical: 12),
              shape: RoundedRectangleBorder(
                borderRadius: BorderRadius.circular(12),
              ),
            ),
            child: const Text(
              'Đặt Lịch Ngay',
              style: TextStyle(
                fontWeight: FontWeight.bold,
                color: Colors.black,
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildCard(Map<String, String> appt) {
    final isConfirmed = appt['status'] == 'confirmed';
    return Container(
      margin: const EdgeInsets.only(bottom: 12),
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(16),
        boxShadow: [
          BoxShadow(color: Colors.black.withValues(alpha: 0.05), blurRadius: 8),
        ],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Text(
                appt['service']!,
                style: const TextStyle(
                  fontWeight: FontWeight.bold,
                  fontSize: 16,
                ),
              ),
              Container(
                padding: const EdgeInsets.symmetric(
                  horizontal: 10,
                  vertical: 4,
                ),
                decoration: BoxDecoration(
                  color: isConfirmed
                      ? Colors.green.shade100
                      : Colors.orange.shade100,
                  borderRadius: BorderRadius.circular(20),
                ),
                child: Text(
                  isConfirmed ? 'Đã xác nhận' : 'Chờ xác nhận',
                  style: TextStyle(
                    color: isConfirmed
                        ? Colors.green.shade700
                        : Colors.orange.shade700,
                    fontSize: 12,
                  ),
                ),
              ),
            ],
          ),
          const SizedBox(height: 8),
          Row(
            children: [
              Icon(Icons.calendar_today, size: 14, color: Colors.grey.shade500),
              const SizedBox(width: 6),
              Text(
                appt['date']!,
                style: TextStyle(color: Colors.grey.shade600),
              ),
            ],
          ),
          const SizedBox(height: 4),
          Row(
            children: [
              Icon(Icons.access_time, size: 14, color: Colors.grey.shade500),
              const SizedBox(width: 6),
              Text(
                appt['time']!,
                style: TextStyle(color: Colors.grey.shade600),
              ),
            ],
          ),
          const SizedBox(height: 4),
          Row(
            children: [
              Icon(Icons.person, size: 14, color: Colors.grey.shade500),
              const SizedBox(width: 6),
              Text(
                appt['barber']!,
                style: TextStyle(color: Colors.grey.shade600),
              ),
            ],
          ),
        ],
      ),
    );
  }
}
