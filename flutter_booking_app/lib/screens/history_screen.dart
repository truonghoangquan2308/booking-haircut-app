import 'package:flutter/material.dart';
import 'dart:async';
import 'package:flutter_booking_app/app_session.dart';
import 'package:flutter_booking_app/services/api_service.dart';
import 'review_screen.dart';

class HistoryScreen extends StatefulWidget {
  const HistoryScreen({super.key, this.initialTab = 0});
  final int initialTab;
  @override
  State<HistoryScreen> createState() => _HistoryScreenState();
}

class _HistoryScreenState extends State<HistoryScreen>
    with SingleTickerProviderStateMixin {
  late TabController _tabController;
  List<Map<String, dynamic>> _allHistory = const [];
  Map<int, Map<String, dynamic>> _reviewByAppointment = const {};
  bool _loading = true;
  String? _error;
  Timer? _pollTimer;

  @override
  void initState() {
    super.initState();
    _tabController = TabController(
      length: 2,
      vsync: this,
      initialIndex: widget.initialTab.clamp(0, 1).toInt(),
    );
    _loadHistory();
    _pollTimer = Timer.periodic(const Duration(seconds: 4), (_) {
      if (!mounted) return;
      _loadHistory(silent: true);
    });
  }

  @override
  void dispose() {
    _pollTimer?.cancel();
    _tabController.dispose();
    super.dispose();
  }

  Future<void> _loadHistory({bool silent = false}) async {
    final customerId = AppSession.userId ?? 0;
    if (customerId <= 0) {
      if (!mounted) return;
      setState(() {
        _loading = false;
        _error = 'Thiếu thông tin người dùng để tải lịch sử';
      });
      return;
    }

    if (!silent && mounted) {
      setState(() {
        _loading = true;
        _error = null;
      });
    }

    try {
      final raw = await ApiService.getCustomerAppointments(customerId);
      final rows = raw
          .whereType<Map>()
          .map((e) => Map<String, dynamic>.from(e))
          .toList(growable: false);
      final allReviews = await ApiService.getReviews();
      final byAppointment = <int, Map<String, dynamic>>{};
      for (final review in allReviews) {
        final reviewCustomerId = _toInt(review['customer_id']);
        final appointmentId = _toInt(review['appointment_id']);
        if (reviewCustomerId != customerId || appointmentId <= 0) continue;
        final existing = byAppointment[appointmentId];
        if (existing == null) {
          byAppointment[appointmentId] = review;
          continue;
        }
        final currentDate = (review['created_at'] ?? '').toString();
        final existingDate = (existing['created_at'] ?? '').toString();
        if (currentDate.compareTo(existingDate) > 0) {
          byAppointment[appointmentId] = review;
        }
      }
      if (!mounted) return;
      setState(() {
        _allHistory = rows;
        _reviewByAppointment = byAppointment;
        _loading = false;
        _error = null;
      });
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _loading = false;
        _error = e.toString();
      });
    }
  }

  String _formatDateLabel(String? ymd) {
    final dt = DateTime.tryParse(ymd ?? '');
    if (dt == null) return ymd ?? '---';
    return '${dt.day} Tháng ${dt.month}, ${dt.year}';
  }

  String _formatDayTimeLabel(String? ymd, String? startTime) {
    final dt = DateTime.tryParse(ymd ?? '');
    final weekdayNames = <int, String>{
      DateTime.monday: 'Thứ 2',
      DateTime.tuesday: 'Thứ 3',
      DateTime.wednesday: 'Thứ 4',
      DateTime.thursday: 'Thứ 5',
      DateTime.friday: 'Thứ 6',
      DateTime.saturday: 'Thứ 7',
      DateTime.sunday: 'Chủ nhật',
    };
    final weekday = dt == null ? '' : (weekdayNames[dt.weekday] ?? '');
    final time = (startTime ?? '').trim();
    final shortTime = time.length >= 5 ? time.substring(0, 5) : time;
    if (weekday.isEmpty && shortTime.isEmpty) return '';
    if (weekday.isEmpty) return shortTime;
    if (shortTime.isEmpty) return weekday;
    return '$weekday $shortTime';
  }

  String _formatPrice(dynamic value) {
    final raw = value?.toString().trim() ?? '';
    if (raw.isEmpty) return '';
    final n = double.tryParse(raw.replaceAll(',', ''));
    if (n == null) return raw;
    if (n >= 1000) {
      final k = n / 1000;
      return k % 1 == 0 ? '${k.toStringAsFixed(0)}k' : '${k.toStringAsFixed(1)}k';
    }
    return '${n.toStringAsFixed(0)}đ';
  }

  @override
  Widget build(BuildContext context) {
    final completed = _allHistory
        .where((h) => _statusKey(h['status']) == 'completed')
        .toList();
    return Scaffold(
      backgroundColor: Colors.white,
      appBar: AppBar(
        backgroundColor: const Color(0xffffc107),
        title: const Text(
          'Lịch sử cắt tóc',
          style: TextStyle(fontWeight: FontWeight.bold),
        ),
        foregroundColor: Colors.black,
        elevation: 0,
        automaticallyImplyLeading: true,
        bottom: TabBar(
          controller: _tabController,
          labelColor: Colors.white,
          unselectedLabelColor: Colors.black54,
          indicatorColor: Colors.white,
          labelStyle: const TextStyle(fontWeight: FontWeight.bold, fontSize: 14),
          unselectedLabelStyle: const TextStyle(fontWeight: FontWeight.w600),
          tabs: const [
            Tab(text: 'Tất Cả'),
            Tab(text: 'Đã Hoàn Thành'),
          ],
        ),
      ),
      body: TabBarView(
        controller: _tabController,
        children: [
          _buildList(_allHistory, sectionTitle: 'Lịch hẹn của tất cả'),
          _buildList(completed, sectionTitle: 'Đã hoàn thành'),
        ],
      ),
    );
  }

  /// Chuẩn hóa status từ API (tránh lệch chữ hoa/thường).
  String _statusKey(dynamic raw) =>
      (raw?.toString() ?? '').trim().toLowerCase();

  Widget _buildList(
    List<Map<String, dynamic>> list, {
    required String sectionTitle,
  }) {
    return Container(
      color: Colors.white,
      child: RefreshIndicator(
        onRefresh: _loadHistory,
        child: Builder(
          builder: (context) {
            if (_loading) {
              return ListView(
                physics: const AlwaysScrollableScrollPhysics(),
                children: const [
                  SizedBox(height: 260),
                  Center(
                    child: CircularProgressIndicator(
                      color: Color(0xffffc107),
                    ),
                  ),
                ],
              );
            }

            if (_error != null) {
              return ListView(
                physics: const AlwaysScrollableScrollPhysics(),
                padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 24),
                children: [
                  Text(
                    'Không tải được lịch sử: $_error',
                    textAlign: TextAlign.center,
                    style: TextStyle(
                      color: Colors.grey.shade800,
                      fontSize: 15,
                    ),
                  ),
                ],
              );
            }

            if (list.isEmpty) {
              return ListView(
                physics: const AlwaysScrollableScrollPhysics(),
                padding: const EdgeInsets.symmetric(vertical: 40),
                children: [
                  Center(
                    child: Text(
                      'Không có lịch sử',
                      style: TextStyle(
                        color: Colors.grey.shade700,
                        fontSize: 16,
                        fontWeight: FontWeight.w600,
                      ),
                    ),
                  ),
                ],
              );
            }

            return ListView.builder(
              physics: const AlwaysScrollableScrollPhysics(),
              padding: const EdgeInsets.all(16),
              itemCount: list.length + 1,
              itemBuilder: (context, index) {
                if (index == 0) {
                  return Padding(
                    padding: const EdgeInsets.only(bottom: 12),
                    child: Text(
                      sectionTitle,
                      style: const TextStyle(
                        fontWeight: FontWeight.bold,
                        fontSize: 16,
                      ),
                    ),
                  );
                }
                return _buildHistoryItem(list[index - 1]);
              },
            );
          },
        ),
      ),
    );
  }

  int _toInt(dynamic value) {
    if (value is int) return value;
    if (value is num) return value.toInt();
    return int.tryParse(value?.toString() ?? '') ?? 0;
  }

  String _statusDisplayVi(String key) {
    switch (key) {
      case 'pending':
        return 'Chờ xác nhận';
      case 'confirmed':
        return 'Đã xác nhận';
      case 'in_progress':
        return 'Đang thực hiện';
      case 'completed':
        return 'Đã hoàn thành';
      case 'cancelled':
        return 'Đã hủy';
      default:
        return key.isEmpty ? '—' : key;
    }
  }

  Widget _buildHistoryItem(Map<String, dynamic> item) {
    final status = _statusKey(item['status']);
    final isCompleted = status == 'completed';
    final barberName = (item['barber_name'] ??
            item['barber_full_name'] ??
            item['barber'] ??
            '---')
        .toString();
    final serviceName = (item['service_name'] ?? item['service'] ?? '---').toString();
    final apptDate = item['appt_date']?.toString();
    final startTime = item['start_time']?.toString();
    final dateLabel = _formatDateLabel(apptDate);
    final dayTimeLabel = _formatDayTimeLabel(apptDate, startTime);

    final appointmentId = _toInt(item['id']);
    final customerId = _toInt(item['customer_id']) > 0
        ? _toInt(item['customer_id'])
        : (AppSession.userId ?? 0);
    final barberId = _toInt(item['barber_id']);
    final existingReview =
        appointmentId > 0 ? _reviewByAppointment[appointmentId] : null;
    final hasReviewed = existingReview != null;

    final cardBg = isCompleted ? const Color(0xFF1B5E20) : Colors.white;
    final primaryText = isCompleted ? Colors.white : Colors.black87;
    final secondaryText =
        isCompleted ? Colors.white70 : Colors.grey.shade600;
    final priceColor = isCompleted ? Colors.white : const Color(0xffffc107);
    final reviewLinkColor =
        isCompleted ? Colors.white : (hasReviewed ? Colors.green.shade700 : Colors.blue);

    return Container(
      margin: const EdgeInsets.only(bottom: 12),
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: cardBg,
        borderRadius: BorderRadius.circular(16),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withValues(alpha: 0.05),
            blurRadius: 8,
            offset: const Offset(0, 4),
          ),
        ],
      ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          CircleAvatar(
            radius: 22,
            backgroundColor:
                isCompleted ? Colors.white : const Color(0xffffc107),
            child: Text(
              barberName.isEmpty ? '?' : barberName[0].toUpperCase(),
              style: TextStyle(
                fontWeight: FontWeight.bold,
                color: isCompleted ? const Color(0xFF1B5E20) : Colors.white,
              ),
            ),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  dateLabel,
                  style: TextStyle(
                    fontWeight: FontWeight.bold,
                    color: primaryText,
                  ),
                ),
                Text(
                  dayTimeLabel,
                  style: TextStyle(color: secondaryText, fontSize: 12),
                ),
                Text(
                  serviceName,
                  style: TextStyle(fontSize: 13, color: primaryText),
                ),
                const SizedBox(height: 6),
                Text(
                  _statusDisplayVi(status),
                  style: TextStyle(
                    fontSize: 12,
                    fontWeight: FontWeight.w600,
                    color: isCompleted ? Colors.white : Colors.black87,
                  ),
                ),
              ],
            ),
          ),
          Column(
            crossAxisAlignment: CrossAxisAlignment.end,
            children: [
              Text(
                barberName,
                style: TextStyle(
                  fontWeight: FontWeight.bold,
                  color: primaryText,
                ),
              ),
              Text(
                _formatPrice(item['total_price'] ?? item['price']),
                style: TextStyle(
                  color: priceColor,
                  fontWeight: FontWeight.bold,
                ),
              ),
              if (isCompleted &&
                  appointmentId > 0 &&
                  customerId > 0 &&
                  barberId > 0)
                GestureDetector(
                  onTap: () async {
                    await Navigator.push(
                      context,
                      MaterialPageRoute(
                        builder: (_) => ReviewScreen(
                          barberName: barberName,
                          serviceName: serviceName,
                          appointmentId: appointmentId,
                          customerId: customerId,
                          barberId: barberId,
                          existingReview: existingReview,
                          readOnly: hasReviewed,
                        ),
                      ),
                    );
                    if (!mounted) return;
                    _loadHistory(silent: true);
                  },
                  child: Text(
                    hasReviewed ? 'Đã đánh giá' : 'Đánh giá',
                    style: TextStyle(
                      color: reviewLinkColor,
                      fontSize: 12,
                      decoration: TextDecoration.underline,
                      fontWeight: FontWeight.w600,
                    ),
                  ),
                ),
            ],
          ),
        ],
      ),
    );
  }
}
