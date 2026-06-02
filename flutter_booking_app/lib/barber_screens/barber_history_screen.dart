import 'package:flutter/material.dart';
import 'package:flutter/cupertino.dart';
import 'package:intl/intl.dart';
import 'package:flutter_booking_app/core/widgets/appointment_card.dart';
import 'package:flutter_booking_app/core/widgets/skeleton_loader.dart';
import 'package:flutter_booking_app/core/theme/app_theme.dart';
import 'package:flutter_booking_app/app_session.dart';
import 'package:flutter_booking_app/services/api_service.dart';
import 'customer_reviews_screen.dart';

class BarberHistoryScreen extends StatefulWidget {
  const BarberHistoryScreen({super.key});

  @override
  State<BarberHistoryScreen> createState() => _BarberHistoryScreenState();
}

class _BarberHistoryScreenState extends State<BarberHistoryScreen> {
  String _filter = 'Hôm nay'; // Hôm nay | Tuần | Tháng

  bool _loading = true;
  String? _error;
  List<dynamic> _allAppointments = [];

  String _ymd(DateTime d) => d.toIso8601String().substring(0, 10); // YYYY-MM-DD

  bool _isInWeek(String apptDateYmd) {
    final d = DateTime.tryParse(apptDateYmd);
    if (d == null) return false;
    final now = DateTime.now();
    final start = now.subtract(Duration(days: now.weekday - 1)); // Monday
    final end = start.add(const Duration(days: 7));
    return d.isAtSameMomentAs(start) || (d.isAfter(start) && d.isBefore(end));
  }

  bool _isInMonth(String apptDateYmd) {
    final d = DateTime.tryParse(apptDateYmd);
    if (d == null) return false;
    final now = DateTime.now();
    return d.year == now.year && d.month == now.month;
  }

  Future<void> _load() async {
    if (!mounted) return;
    setState(() {
      _loading = true;
      _error = null;
    });

    try {
      final userId = AppSession.userId ?? 0;
      if (userId <= 0) throw Exception('Missing AppSession.userId');

      final m = await ApiService.getBarberByUserId(userId);
      try {
        debugPrint('BarberHistory: AppSession.userId=$userId');
        debugPrint('BarberHistory: barber row => $m');
      } catch (_) {}
      final barberId = (m['barber_id'] as num?)?.toInt() ?? 0;

      if (barberId <= 0) {
        throw Exception('Không tìm thấy barber tương ứng');
      }

      final appts = await ApiService.getBarberAppointments(barberId);
      // Chỉ lấy completed để hiển thị lịch sử/đánh giá
      final completed = appts
          .where((a) {
            final s = (a['status']?.toString() ?? '');
            return s == 'completed' || s == 'paid_and_done';
          })
          .toList(growable: false);

      setState(() {
        _allAppointments = completed;
        _loading = false;
      });
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _error = e.toString();
        _loading = false;
      });
    }
  }

  @override
  void initState() {
    super.initState();
    _load();
  }

  @override
  Widget build(BuildContext context) {
    final todayYmd = _ymd(DateTime.now());

    final filtered = _allAppointments
        .where((a) {
          final d = a['appt_date']?.toString() ?? '';
          if (d.isEmpty) return false;
          if (_filter == 'Hôm nay') return d == todayYmd;
          if (_filter == 'Tuần') return _isInWeek(d);
          if (_filter == 'Tháng') return _isInMonth(d);
          return false;
        })
        .toList(growable: false);

    final formatter = NumberFormat('#,###', 'vi_VN');

    return Column(
      children: [
        _buildHeader(),
        Padding(
          padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
          child: Container(
            padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 12),
            decoration: BoxDecoration(
              color: Colors.white,
              borderRadius: BorderRadius.circular(12),
              boxShadow: [
                BoxShadow(
                  color: Colors.black.withAlpha((0.04 * 255).round()),
                  blurRadius: 8,
                ),
              ],
            ),
            child: Row(
              children: [
                Text(
                  '${filtered.length} lịch',
                  style: Theme.of(
                    context,
                  ).textTheme.titleLarge?.copyWith(fontWeight: FontWeight.w600),
                ),
                const Spacer(),
                Text(
                  'Tổng: ${formatter.format(filtered.fold<double>(0, (p, a) => p + (double.tryParse((a['total_price']?.toString() ?? '0').replaceAll(',', '')) ?? 0)))}đ',
                  style: Theme.of(context).textTheme.bodyLarge?.copyWith(
                    fontWeight: FontWeight.w600,
                    color: AppTheme.primaryDark,
                  ),
                ),
              ],
            ),
          ),
        ),
        Expanded(
          child: Container(
            color: const Color(0xfff4f5f9),
            child: Column(
              children: [
                Padding(
                  padding: const EdgeInsets.all(16),
                  child: Row(
                    children: [
                      _FilterTab(
                        label: 'Hôm nay',
                        selected: _filter == 'Hôm nay',
                        onTap: () => setState(() => _filter = 'Hôm nay'),
                      ),
                      const SizedBox(width: 8),
                      _FilterTab(
                        label: 'Tuần',
                        selected: _filter == 'Tuần',
                        onTap: () => setState(() => _filter = 'Tuần'),
                      ),
                      const SizedBox(width: 8),
                      _FilterTab(
                        label: 'Tháng',
                        selected: _filter == 'Tháng',
                        onTap: () => setState(() => _filter = 'Tháng'),
                      ),
                    ],
                  ),
                ),
                Expanded(
                  child: RefreshIndicator(
                    onRefresh: _load,
                    color: const Color(0xffffc107),
                    child: _loading
                        ? ListView(
                            physics: const AlwaysScrollableScrollPhysics(),
                            children: const [
                              SizedBox(height: 24),
                              Padding(
                                padding: EdgeInsets.symmetric(horizontal: 16),
                                child: SkeletonScheduleList(),
                              ),
                            ],
                          )
                        : _error != null
                        ? ListView(
                            physics: const AlwaysScrollableScrollPhysics(),
                            children: [Center(child: Text('Lỗi: $_error'))],
                          )
                        : Column(
                            children: [
                              Padding(
                                padding: const EdgeInsets.symmetric(
                                  horizontal: 16,
                                  vertical: 8,
                                ),
                                child: Row(
                                  children: [
                                    Text(
                                      '${filtered.length} lịch',
                                      style: Theme.of(context)
                                          .textTheme
                                          .labelSmall
                                          ?.copyWith(
                                            color: AppTheme.textSecondary,
                                          ),
                                    ),
                                    const Spacer(),
                                    Text(
                                      'Tổng: ${formatter.format(filtered.fold<double>(0, (p, a) => p + (double.tryParse((a['total_price']?.toString() ?? '0').replaceAll(',', '')) ?? 0)))}đ',
                                      style: const TextStyle(
                                        fontWeight: FontWeight.w600,
                                        color: AppTheme.primaryDark,
                                      ),
                                    ),
                                  ],
                                ),
                              ),
                              ListView.builder(
                                physics: const NeverScrollableScrollPhysics(),
                                shrinkWrap: true,
                                padding: const EdgeInsets.symmetric(
                                  horizontal: 16,
                                ),
                                itemCount: filtered.length,
                                itemBuilder: (context, index) {
                                  final a =
                                      filtered[index] as Map<String, dynamic>;
                                  return Padding(
                                    padding: const EdgeInsets.only(bottom: 12),
                                    child: AppointmentCard(
                                      customerName:
                                          a['customer_name']?.toString() ??
                                          a['customer_full_name']?.toString() ??
                                          '---',
                                      time:
                                          a['start_time']?.toString() ?? '---',
                                      serviceCode:
                                          a['service_name']?.toString() ??
                                          '---',
                                      amount:
                                          double.tryParse(
                                            (a['total_price']?.toString() ??
                                                    '0')
                                                .replaceAll(',', ''),
                                          ) ??
                                          0,
                                      isRated: (a['is_rated'] == true),
                                      onTap: () {
                                        Navigator.push(
                                          context,
                                          CupertinoPageRoute(
                                            builder: (_) =>
                                                const CustomerReviewsScreen(),
                                          ),
                                        );
                                      },
                                    ),
                                  );
                                },
                              ),
                            ],
                          ),
                  ),
                ),
              ],
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
              child: Icon(Icons.history, color: Color(0xffffc107), size: 28),
            ),
          ),
          const SizedBox(width: 12),
          Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                'Lịch sử cắt tóc',
                style: Theme.of(
                  context,
                ).textTheme.titleLarge?.copyWith(fontWeight: FontWeight.bold),
              ),
              Text(
                'Haircut Booking — Thợ',
                style: Theme.of(context).textTheme.labelSmall,
              ),
            ],
          ),
        ],
      ),
    );
  }
}

class _FilterTab extends StatelessWidget {
  final String label;
  final bool selected;
  final VoidCallback onTap;

  const _FilterTab({
    required this.label,
    required this.selected,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    return Expanded(
      child: InkWell(
        borderRadius: BorderRadius.circular(99),
        onTap: onTap,
        child: AnimatedContainer(
          duration: const Duration(milliseconds: 200),
          padding: const EdgeInsets.symmetric(vertical: 8, horizontal: 20),
          decoration: BoxDecoration(
            color: selected ? AppTheme.primaryColor : Colors.transparent,
            borderRadius: BorderRadius.circular(99),
            border: Border.all(color: AppTheme.borderColor, width: 0.5),
          ),
          child: Center(
            child: Text(
              label,
              style: TextStyle(
                color: selected ? Colors.black87 : AppTheme.textSecondary,
                fontWeight: selected ? FontWeight.w500 : FontWeight.w400,
              ),
            ),
          ),
        ),
      ),
    );
  }
}
