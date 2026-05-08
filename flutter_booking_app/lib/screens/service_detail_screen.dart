// lib/screens/service_detail_screen.dart
import 'package:flutter/material.dart';
import 'time_slot_screen.dart';

class ServiceDetailScreen extends StatelessWidget {
  final String serviceName, servicePrice, barberName, barberRating;
  const ServiceDetailScreen({
    super.key,
    required this.serviceName,
    required this.servicePrice,
    required this.barberName,
    required this.barberRating,
  });

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xfff4f5f9),
      appBar: AppBar(
        backgroundColor: const Color(0xffffc107),
        title: const Text(
          'Chi Tiết Dịch Vụ',
          style: TextStyle(fontWeight: FontWeight.bold),
        ),
        elevation: 0,
      ),
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Container(
              height: 200,
              width: double.infinity,
              decoration: BoxDecoration(
                color: const Color(0xfff5f5f7),
                borderRadius: BorderRadius.circular(20),
              ),
              child: const Center(
                child: Icon(
                  Icons.content_cut,
                  size: 80,
                  color: Color(0xffffc107),
                ),
              ),
            ),
            const SizedBox(height: 16),
            Text(
              serviceName,
              style: const TextStyle(fontSize: 22, fontWeight: FontWeight.bold),
            ),
            const SizedBox(height: 8),
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
              decoration: BoxDecoration(
                color: const Color(0xffffc107),
                borderRadius: BorderRadius.circular(20),
              ),
              child: Text(
                servicePrice,
                style: const TextStyle(fontWeight: FontWeight.bold),
              ),
            ),
            const SizedBox(height: 16),
            const Text(
              'Mô tả',
              style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold),
            ),
            const SizedBox(height: 8),
            Text(
              'Dịch vụ $serviceName chuyên nghiệp tại hệ thống Haircut Booking App.',
              style: TextStyle(color: Colors.grey.shade700),
            ),
            const SizedBox(height: 20),
            const Text(
              'Thợ đã chọn',
              style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold),
            ),
            const SizedBox(height: 8),
            Container(
              padding: const EdgeInsets.all(12),
              decoration: BoxDecoration(
                color: Colors.white,
                borderRadius: BorderRadius.circular(14),
                boxShadow: [
                  BoxShadow(
                    color: Colors.black.withValues(alpha: 0.05),
                    blurRadius: 8,
                  ),
                ],
              ),
              child: Row(
                children: [
                  const CircleAvatar(
                    backgroundColor: Color(0xfff5f5f7),
                    child: Icon(Icons.person, color: Colors.grey),
                  ),
                  const SizedBox(width: 12),
                  Text(
                    barberName,
                    style: const TextStyle(fontWeight: FontWeight.w600),
                  ),
                  const Spacer(),
                  const Icon(Icons.star, color: Color(0xffffc107), size: 16),
                  const SizedBox(width: 4),
                  Text(barberRating),
                ],
              ),
            ),
            const SizedBox(height: 24),
            SizedBox(
              width: double.infinity,
              child: ElevatedButton(
                onPressed: () => Navigator.of(context).push(
                  MaterialPageRoute(
                    builder: (_) => TimeSlotScreen(
                      serviceName: serviceName,
                      servicePrice: servicePrice,
                      barberName: barberName,
                    ),
                  ),
                ),
                style: ElevatedButton.styleFrom(
                  backgroundColor: const Color(0xffffc107),
                  padding: const EdgeInsets.symmetric(vertical: 14),
                  shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(14),
                  ),
                ),
                child: const Text(
                  'Đặt lịch ngay',
                  style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold),
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}
