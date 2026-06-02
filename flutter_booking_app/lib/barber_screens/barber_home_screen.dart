import 'package:firebase_auth/firebase_auth.dart';
import 'package:flutter/material.dart';
import 'package:flutter/cupertino.dart';
import 'package:flutter_booking_app/core/widgets/appointment_card.dart';
import 'package:flutter_booking_app/core/widgets/empty_state_widget.dart';
// removed unused import
import 'package:flutter_booking_app/core/theme/app_theme.dart';
import 'dart:async';
import 'package:flutter_booking_app/app_session.dart';
import 'package:flutter_booking_app/screens/edit_profile_screen.dart';
import 'package:flutter_booking_app/services/api_service.dart';
import 'package:flutter_booking_app/services/barber_notifications_service.dart';

import 'appointment_detail_screen.dart';
import 'barber_notifications_screen.dart';
import 'work_schedule_screen.dart';

class BarberHomeScreen extends StatefulWidget {
  const BarberHomeScreen({super.key});

  @override
  State<BarberHomeScreen> createState() => _BarberHomeScreenState();
}

class _StatCard extends StatelessWidget {
  final String label;
  final String value;
  final Color bgColor;
  final Color textColor;

  const _StatCard({
    required this.label,
    required this.value,
    required this.bgColor,
    required this.textColor,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: bgColor,
        borderRadius: AppTheme.cardRadius,
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            label,
            style: Theme.of(
              context,
            ).textTheme.labelSmall?.copyWith(color: AppTheme.textSecondary),
          ),
          const SizedBox(height: 8),
          Text(
            value,
            style: Theme.of(context).textTheme.headlineMedium?.copyWith(
              color: textColor,
              fontWeight: FontWeight.w600,
            ),
          ),
        ],
      ),
    );
  }
}

// rating card removed — reviews are shown only in history screen

class _BarberHomeScreenState extends State<BarberHomeScreen> {
  late Future<UserProfile?> _profileFuture;
  final _notifications = BarberNotificationsService.instance;

  bool _loadingHome = false;
  int _todayCount = 0;
  double _todayIncome = 0;
  // rating removed from home; reviews shown in history only
  // removed unused future appointments list
  List<dynamic> _todayAppointments = [];

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
    await Navigator.of(context).push(
      MaterialPageRoute(builder: (_) => const BarberNotificationsScreen()),
    );
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
    return '${parts.join('.')}đ';
  }

  String _todayYmd() => DateTime.now().toIso8601String().substring(0, 10);

  Future<void> _loadHomeData() async {
    if (_loadingHome) return;
    final userId = AppSession.userId ?? 0;
    if (!mounted) return;
    if (userId <= 0) return;

    setState(() => _loadingHome = true);

    try {
      // 1) Lấy barberId + rating theo userId (API nhẹ /api/barbers/by-user/:id)
      final barberRow = await ApiService.getBarberByUserId(userId);

      try {
        debugPrint('BarberHome: AppSession.userId=$userId');
        debugPrint('BarberHome: barberRow => $barberRow');
      } catch (_) {}

      final barberId =
          (barberRow['barber_id'] as num?)?.toInt() ??
          (barberRow['id'] as num?)?.toInt() ??
          0;

      // rating intentionally ignored on home screen

      // 2) Lấy lịch của barber
      final appts = await ApiService.getBarberAppointments(barberId);
      try {
        debugPrint(
          'BarberHome: loaded ${appts.length} appointments for barberId=$barberId',
        );
      } catch (_) {}
      final ymdToday = _todayYmd();

      // Loại cancelled khỏi thống kê + lịch hiển thị.
      final valid = appts
          .where((a) {
            final status = a['status']?.toString() ?? 'pending';
            return status != 'cancelled';
          })
          .toList(growable: false);

      final todayList = valid
          .where((a) {
            final d = a['appt_date']?.toString() ?? '';
            return d == ymdToday;
          })
          .toList(growable: false);

      final futureList = valid
          .where((a) {
            final d = a['appt_date']?.toString() ?? '';
            return d.compareTo(ymdToday) > 0;
          })
          .toList(growable: false);

      todayList.sort(
        (a, b) => (a['start_time']?.toString() ?? '').compareTo(
          b['start_time']?.toString() ?? '',
        ),
      );
      futureList.sort((a, b) {
        final da = a['appt_date']?.toString() ?? '';
        final db = b['appt_date']?.toString() ?? '';
        final cmp = da.compareTo(db);
        if (cmp != 0) return cmp;
        return (a['start_time']?.toString() ?? '').compareTo(
          b['start_time']?.toString() ?? '',
        );
      });

      // 3) Thu nhập = 60% * tổng giá theo mỗi lần đặt hôm nay.
      double income = 0;
      for (final a in todayList) {
        income += _toDouble(a['total_price']) * 0.6;
      }

      setState(() {
        _todayCount = todayList.length;
        _todayIncome = income;
        // futureList is not shown on this screen; keep for potential future use
        _todayAppointments = todayList;
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
    await Future.wait([profileFuture, _loadHomeData()]);
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
                          style: Theme.of(context).textTheme.displayLarge,
                        ),
                        const SizedBox(height: 20),
                        Row(
                          children: [
                            Expanded(
                              child: _StatCard(
                                label: 'Lịch hôm nay',
                                value: '$_todayCount khách',
                                bgColor: AppTheme.primaryColor,
                                textColor: Colors.black87,
                              ),
                            ),
                            const SizedBox(width: 12),
                            Expanded(
                              child: _StatCard(
                                label: 'Thu nhập hôm nay',
                                value: _fmtVnd(_todayIncome),
                                bgColor: AppTheme.primaryColor,
                                textColor: Colors.black87,
                              ),
                            ),
                          ],
                        ),
                        const SizedBox(height: 25),
                        InkWell(
                          onTap: () {
                            Navigator.push(
                              context,
                              CupertinoPageRoute(
                                builder: (_) => const WorkScheduleScreen(),
                              ),
                            );
                          },
                          borderRadius: BorderRadius.circular(6),
                          child: Row(
                            mainAxisAlignment: MainAxisAlignment.spaceBetween,
                            children: [
                              Text(
                                'Lịch sắp tới',
                                style: Theme.of(context)
                                    .textTheme
                                    .headlineMedium
                                    ?.copyWith(fontWeight: FontWeight.w600),
                              ),
                              const Icon(
                                Icons.chevron_right,
                                color: Colors.grey,
                              ),
                            ],
                          ),
                        ),
                        const SizedBox(height: 15),
                        if (_todayAppointments.isEmpty)
                          Padding(
                            padding: const EdgeInsets.symmetric(vertical: 24),
                            child: Center(
                              child: EmptyStateWidget(
                                title: 'Chưa có lịch hôm nay',
                                subtitle: 'Lịch đặt mới sẽ xuất hiện ở đây',
                              ),
                            ),
                          )
                        else
                          ..._todayAppointments.asMap().entries.map((entry) {
                            final index = entry.key;
                            final a = entry.value as Map<String, dynamic>;
                            final amount = _toDouble(a['total_price']);
                            return Column(
                              children: [
                                AppointmentCard(
                                  customerName:
                                      a['customer_name']?.toString() ??
                                      a['customer_full_name']?.toString() ??
                                      '---',
                                  time: a['start_time']?.toString() ?? '---',
                                  serviceCode:
                                      a['service_name']?.toString() ?? '---',
                                  amount: amount,
                                  isRated: (a['is_rated'] == true),
                                  showReviewButton: false,
                                  onTap: () {
                                    Navigator.push(
                                      context,
                                      CupertinoPageRoute(
                                        builder: (_) => AppointmentDetailScreen(
                                          appointment: a,
                                        ),
                                      ),
                                    );
                                  },
                                ),
                                if (index != _todayAppointments.length - 1)
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
            child: Center(
              child: ClipRRect(
                borderRadius: BorderRadius.circular(10),
                child: Image.asset(
                  'assets/images/skibidi-logo.png',
                  width: 36,
                  height: 36,
                  fit: BoxFit.contain,
                  errorBuilder: (context, error, stackTrace) => const Icon(
                    Icons.content_cut,
                    color: Colors.orange,
                    size: 26,
                  ),
                ),
              ),
            ),
          ),
          const SizedBox(width: 12),
          const Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                'SKIBIDI',
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

  @override
  void dispose() {
    _pollTimer?.cancel();
    super.dispose();
  }
}
