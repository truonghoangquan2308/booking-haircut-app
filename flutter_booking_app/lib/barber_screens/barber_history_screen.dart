import 'package:flutter/material.dart';
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
      final barberId = (m['barber_id'] as num?)?.toInt() ?? 0;

      if (barberId <= 0) {
        throw Exception('Không tìm thấy barber tương ứng');
      }

      final appts = await ApiService.getBarberAppointments(barberId);
      // Chỉ lấy completed để hiển thị lịch sử/đánh giá
      final completed = appts
          .where((a) => (a['status']?.toString() ?? '') == 'completed')
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

    return Column(
      children: [
        _buildHeader(),
        Expanded(
          child: Container(
            color: const Color(0xfff4f5f9),
            child: Column(
              children: [
                Padding(
                  padding: const EdgeInsets.all(16),
                  child: Container(
                    padding: const EdgeInsets.all(4),
                    decoration: BoxDecoration(
                      color: Colors.grey.shade200,
                      borderRadius: BorderRadius.circular(15),
                    ),
                    child: Row(
                      children: [
                        _buildFilterTab('Hôm nay', _filter == 'Hôm nay'),
                        _buildFilterTab('Tuần', _filter == 'Tuần'),
                        _buildFilterTab('Tháng', _filter == 'Tháng'),
                      ],
                    ),
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
                              SizedBox(height: 220),
                              Center(child: CircularProgressIndicator()),
                            ],
                          )
                        : _error != null
                        ? ListView(
                            physics: const AlwaysScrollableScrollPhysics(),
                            children: [Center(child: Text('Lỗi: $_error'))],
                          )
                        : filtered.isEmpty
                        ? ListView(
                            physics: const AlwaysScrollableScrollPhysics(),
                            children: const [
                              SizedBox(height: 120),
                              Center(child: Text('Không có lịch')),
                            ],
                          )
                        : ListView.builder(
                            physics: const AlwaysScrollableScrollPhysics(),
                            padding: const EdgeInsets.symmetric(horizontal: 16),
                            itemCount: filtered.length,
                            itemBuilder: (context, index) {
                              final a = filtered[index] as Map<String, dynamic>;
                              return _buildHistoryTile(a);
                            },
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
              child: Icon(Icons.history, color: Colors.orange, size: 26),
            ),
          ),
          const SizedBox(width: 12),
          const Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                'Lịch sử cắt tóc',
                style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold),
              ),
              Text('Haircut Booking — Thợ', style: TextStyle(fontSize: 12)),
            ],
          ),
        ],
      ),
    );
  }

  Widget _buildFilterTab(String label, bool isSelected) {
    return Expanded(
      child: GestureDetector(
        onTap: () => setState(() => _filter = label),
        child: Container(
          padding: const EdgeInsets.symmetric(vertical: 10),
          decoration: BoxDecoration(
            color: isSelected ? const Color(0xffffc107) : Colors.transparent,
            borderRadius: BorderRadius.circular(12),
          ),
          child: Center(
            child: Text(
              label,
              style: TextStyle(
                color: isSelected ? Colors.black87 : Colors.black54,
                fontWeight: FontWeight.bold,
              ),
            ),
          ),
        ),
      ),
    );
  }

  String _fmtPrice(dynamic raw) {
    final n = double.tryParse(raw?.toString() ?? '');
    if (n == null) return '';
    return '${n.toStringAsFixed(0)}đ';
  }

  Widget _buildHistoryTile(Map<String, dynamic> a) {
    final time = a['start_time']?.toString() ?? '';
    final timeLabel = time.length >= 5 ? time.substring(0, 5) : time;
    final customer =
        a['customer_name']?.toString() ??
        a['customer_full_name']?.toString() ??
        '---';
    final service = a['service_name']?.toString() ?? '---';
    final price = a['total_price'];

    return Container(
      margin: const EdgeInsets.only(bottom: 15),
      padding: const EdgeInsets.all(12),
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
      child: Row(
        children: [
          Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                timeLabel,
                style: const TextStyle(
                  fontWeight: FontWeight.bold,
                  fontSize: 16,
                ),
              ),
            ],
          ),
          const SizedBox(width: 15),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  customer,
                  style: const TextStyle(
                    fontWeight: FontWeight.bold,
                    fontSize: 16,
                  ),
                ),
                Text(service, style: TextStyle(color: Colors.grey.shade600)),
              ],
            ),
          ),
          SizedBox(
            width: 150,
            child: Row(
              children: [
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.end,
                    children: [
                      Text(
                        _fmtPrice(price),
                        style: TextStyle(
                          color: Colors.orange.shade800,
                          fontWeight: FontWeight.bold,
                          fontSize: 16,
                        ),
                      ),
                      TextButton(
                        onPressed: () {
                          Navigator.push(
                            context,
                            MaterialPageRoute(
                              builder: (_) => const CustomerReviewsScreen(),
                            ),
                          );
                        },
                        child: const Text('Đánh giá'),
                      ),
                    ],
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}
