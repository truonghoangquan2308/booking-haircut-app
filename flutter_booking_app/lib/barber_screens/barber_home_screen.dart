import 'package:firebase_auth/firebase_auth.dart';
import 'package:flutter/material.dart';
import 'dart:async';
import 'package:flutter_booking_app/app_session.dart';
import 'package:flutter_booking_app/screens/edit_profile_screen.dart';
import 'package:flutter_booking_app/services/api_service.dart';
import 'package:flutter_booking_app/services/barber_notifications_service.dart';

import 'appointment_detail_screen.dart';
import 'barber_notifications_screen.dart';

class BarberHomeScreen extends StatefulWidget {
  const BarberHomeScreen({super.key});

  @override
  State<BarberHomeScreen> createState() => _BarberHomeScreenState();
}

class _BarberHomeScreenState extends State<BarberHomeScreen> {
  late Future<UserProfile?> _profileFuture;
  final _notifications = BarberNotificationsService.instance;

  bool _loadingHome = false;
  int _todayCount = 0;
  double _todayIncome = 0;
  double _rating = 0;
  List<dynamic> _futureAppointments = [];

  Timer? _pollTimer;

  @override
  void initState() {
    super.initState();
    _profileFuture = _loadProfile();
    _loadHomeData();

    // Tự cập nhật liên tục khi khách đặt lịch / thợ cập nhật trạng thái.
    _pollTimer = Timer.periodic(const Duration(seconds: 4), (_) {
      if (!mounted) return;
      _loadHomeData();
    });
  }

  Future<UserProfile?> _loadProfile() async {
    final phone =
        AppSession.phone ?? FirebaseAuth.instance.currentUser?.phoneNumber;
    if (phone == null) return null;
    try {
      final map = await ApiService.getUser(phone);
      final p = UserProfile.fromJson(Map<String, dynamic>.from(map));
      AppSession.setFromUserMap(map);
      return p;
    } catch (_) {
      return null;
    }
  }

  Future<void> _openNotifications() async {
    await Navigator.of(
      context,
    ).push(MaterialPageRoute(builder: (_) => const BarberNotificationsScreen()));
  }

  double _toDouble(dynamic v) {
    final s = v?.toString().trim() ?? '';
    if (s.isEmpty) return 0;
    return double.tryParse(s.replaceAll(',', '')) ?? 0;
  }

  String _fmtVnd(double v) {
    final n = v.round();
    final s = n.toString();
    final parts = <String>[];
    for (int i = s.length; i > 0; i -= 3) {
      final start = (i - 3) > 0 ? i - 3 : 0;
      parts.insert(0, s.substring(start, i));
    }
    return '${parts.join('.') }đ';
  }

  String _todayYmd() =>
      DateTime.now().toIso8601String().substring(0, 10);

  Future<void> _loadHomeData() async {
    if (_loadingHome) return;
    final userId = AppSession.userId ?? 0;
    if (!mounted) return;
    if (userId <= 0) return;

    setState(() => _loadingHome = true);

    try {
      // 1) Lấy barberId + rating theo userId (API nhẹ /api/barbers/by-user/:id)
      final barberRow = await ApiService.getBarberByUserId(userId);

      final barberId = (barberRow['barber_id'] as num?)?.toInt() ??
          (barberRow['id'] as num?)?.toInt() ??
          0;

      _rating = _toDouble(barberRow['rating']);

      // 2) Lấy lịch của barber
      final appts = await ApiService.getBarberAppointments(barberId);
      final ymdToday = _todayYmd();

      // Loại cancelled khỏi thống kê + lịch hiển thị.
      final valid = appts.where((a) {
        final status = a['status']?.toString() ?? 'pending';
        return status != 'cancelled';
      }).toList(growable: false);

      final todayList = valid.where((a) {
        final d = a['appt_date']?.toString() ?? '';
        return d == ymdToday;
      }).toList(growable: false);

      final futureList = valid.where((a) {
        final d = a['appt_date']?.toString() ?? '';
        return d.compareTo(ymdToday) > 0;
      }).toList(growable: false);

      todayList.sort((a, b) =>
          (a['start_time']?.toString() ?? '').compareTo(
              b['start_time']?.toString() ?? ''));
      futureList.sort((a, b) {
        final da = a['appt_date']?.toString() ?? '';
        final db = b['appt_date']?.toString() ?? '';
        final cmp = da.compareTo(db);
        if (cmp != 0) return cmp;
        return (a['start_time']?.toString() ?? '').compareTo(
            b['start_time']?.toString() ?? '');
      });

      // 3) Thu nhập = 60% * tổng giá theo mỗi lần đặt hôm nay.
      double income = 0;
      for (final a in todayList) {
        income += _toDouble(a['total_price']) * 0.6;
      }

      setState(() {
        _todayCount = todayList.length;
        _todayIncome = income;
        _futureAppointments = futureList;
        _loadingHome = false;
      });
    } catch (_) {
      if (!mounted) return;
      setState(() {
        _loadingHome = false;
      });
    }
  }

  Future<void> _refreshHome() async {
    final profileFuture = _loadProfile();
    setState(() {
      _profileFuture = profileFuture;
    });
    await Future.wait([
      profileFuture,
      _loadHomeData(),
    ]);
  }

  @override
  Widget build(BuildContext context) {
    return Column(
      children: [
        _buildHeader(),
        Expanded(
          child: Container(
            color: const Color(0xfff4f5f9),
            child: RefreshIndicator(
              onRefresh: _refreshHome,
              color: const Color(0xffffc107),
              child: FutureBuilder<UserProfile?>(
                future: _profileFuture,
                builder: (context, snapshot) {
                  final name = snapshot.data?.fullName.isNotEmpty == true
                      ? snapshot.data!.fullName
                      : 'Thợ cắt tóc';
                  return SingleChildScrollView(
                    physics: const AlwaysScrollableScrollPhysics(),
                    padding: const EdgeInsets.all(16),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          'Xin chào, $name',
                          style: const TextStyle(
                            fontSize: 22,
                            fontWeight: FontWeight.bold,
                          ),
                        ),
                        const SizedBox(height: 20),
                        Row(
                          children: [
                            Expanded(
                              child: _buildStatCard(
                                'Lịch hôm nay',
                                '$_todayCount khách',
                                true,
                              ),
                            ),
                            const SizedBox(width: 15),
                            Expanded(
                              child: _buildStatCard(
                                'Thu nhập hôm nay',
                                _fmtVnd(_todayIncome),
                                false,
                              ),
                            ),
                          ],
                        ),
                        const SizedBox(height: 15),
                        _buildRatingBar(),
                        const SizedBox(height: 25),
                        const Text(
                          'Lịch sắp tới',
                          style: TextStyle(
                            fontSize: 18,
                            fontWeight: FontWeight.bold,
                          ),
                        ),
                        const SizedBox(height: 15),
                        if (_futureAppointments.isEmpty)
                          const Padding(
                            padding: EdgeInsets.symmetric(vertical: 24),
                            child: Center(child: Text('Không có lịch sắp tới')),
                          )
                        else
                          ..._futureAppointments.asMap().entries.map((entry) {
                            final index = entry.key;
                            final a = entry.value as Map<String, dynamic>;
                            return Column(
                              children: [
                                _AppointmentTile(
                                  appointment: a,
                                  time: a['start_time']?.toString() ?? '---',
                                  name: a['customer_name']?.toString() ??
                                      a['customer_full_name']?.toString() ??
                                      '---',
                                  service:
                                      a['service_name']?.toString() ?? '---',
                                ),
                                if (index != _futureAppointments.length - 1)
                                  const SizedBox(height: 10),
                              ],
                            );
                          }),
                        const SizedBox(height: 8),
                      ],
                    ),
                  );
                },
              ),
            ),
          ),
        ),
      ],
    );
  }

  Widget _buildHeader() {
    return Container(
      width: double.infinity,
      color: const Color(0xffffc107),
      padding: const EdgeInsets.fromLTRB(16, 8, 16, 16),
      child: Row(
        children: [
          Container(
            width: 48,
            height: 48,
            decoration: BoxDecoration(
              color: Colors.white,
              borderRadius: BorderRadius.circular(14),
            ),
            child: const Center(
              child: Icon(Icons.content_cut, color: Colors.orange, size: 26),
            ),
          ),
          const SizedBox(width: 12),
          const Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                'GROUP 5',
                style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold),
              ),
              Text('Haircut Booking — Thợ', style: TextStyle(fontSize: 12)),
            ],
          ),
          const Spacer(),
          ValueListenableBuilder<List<BarberNotificationItem>>(
            valueListenable: _notifications.notifications,
            builder: (context, _, child) {
              final showDot = _notifications.unreadCount > 0;
              return GestureDetector(
                onTap: _openNotifications,
                child: Container(
                  margin: const EdgeInsets.only(right: 8),
                  padding: const EdgeInsets.all(8),
                  decoration: BoxDecoration(
                    color: Colors.white,
                    borderRadius: BorderRadius.circular(12),
                  ),
                  child: Stack(
                    children: [
                      const Icon(Icons.notifications_outlined, size: 22),
                      if (showDot)
                        Positioned(
                          right: 0,
                          top: 0,
                          child: Container(
                            width: 8,
                            height: 8,
                            decoration: const BoxDecoration(
                              color: Colors.red,
                              shape: BoxShape.circle,
                            ),
                          ),
                        ),
                    ],
                  ),
                ),
              );
            },
          ),
        ],
      ),
    );
  }

  Widget _buildStatCard(String title, String value, bool highlight) {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: highlight ? const Color(0xffffc107) : Colors.white,
        borderRadius: BorderRadius.circular(20),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withValues(alpha: 0.06),
            blurRadius: 12,
            offset: const Offset(0, 4),
          ),
        ],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            title,
            style: TextStyle(
              color: highlight ? Colors.black87 : Colors.black54,
              fontSize: 13,
            ),
          ),
          const SizedBox(height: 8),
          Text(
            value,
            style: TextStyle(
              color: highlight ? Colors.black87 : Colors.black,
              fontSize: 18,
              fontWeight: FontWeight.bold,
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildRatingBar() {
    final rating = _rating;
    final stars = rating.clamp(0, 5);
    int filled = stars.floor();
    if (stars - filled >= 0.5) filled = filled + 1;
    filled = filled.clamp(0, 5);

    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
      decoration: BoxDecoration(
        color: const Color(0xffffc107),
        borderRadius: BorderRadius.circular(15),
      ),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          const Text(
            'Đánh giá',
            style: TextStyle(color: Colors.black87, fontWeight: FontWeight.bold),
          ),
          Row(
            children: [
              for (int i = 0; i < 5; i++)
                Icon(
                  i < filled ? Icons.star : Icons.star_border,
                  color: Color(0xffffa000),
                  size: 20,
                ),
              const SizedBox(width: 8),
              Text(rating.toStringAsFixed(1),
                  style: const TextStyle(fontWeight: FontWeight.bold)),
            ],
          ),
        ],
      ),
    );
  }

  @override
  void dispose() {
    _pollTimer?.cancel();
    super.dispose();
  }
}

class _AppointmentTile extends StatelessWidget {
  final String time;
  final String name;
  final String service;
  final Map<String, dynamic> appointment;

  const _AppointmentTile({
    required this.time,
    required this.name,
    required this.service,
    required this.appointment,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(15),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withValues(alpha: 0.05),
            blurRadius: 8,
            offset: const Offset(0, 2),
          ),
        ],
      ),
      child: ListTile(
        leading: Text(
          time,
          style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 16),
        ),
        title: Text(name, style: const TextStyle(fontWeight: FontWeight.bold)),
        subtitle: Text(service, style: const TextStyle(color: Colors.grey)),
        trailing: const Icon(Icons.chevron_right),
        onTap: () {
          Navigator.push(
            context,
            MaterialPageRoute(
              builder: (_) => AppointmentDetailScreen(
                appointment: appointment,
              ),
            ),
          );
        },
      ),
    );
  }
}
