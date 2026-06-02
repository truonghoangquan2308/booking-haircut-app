import 'package:flutter/material.dart';
import 'package:flutter/cupertino.dart';
import 'package:flutter_booking_app/core/widgets/skeleton_loader.dart';
import 'package:flutter_booking_app/core/widgets/appointment_card.dart';
import 'dart:async';
import 'package:flutter_booking_app/app_session.dart';
import 'package:flutter_booking_app/services/api_service.dart';

import 'appointment_detail_screen.dart';

class WorkScheduleScreen extends StatefulWidget {
  const WorkScheduleScreen({super.key});

  @override
  State<WorkScheduleScreen> createState() => _WorkScheduleScreenState();
}

class _WorkScheduleScreenState extends State<WorkScheduleScreen> {
  DateTime _selectedDate = DateTime.now();
  late DateTime _weekStart;
  bool _loading = true;
  String? _error;
  List<dynamic> _appointments = [];
  Timer? _pollTimer;

  String _fmtDate(DateTime d) =>
      '${d.year}-${d.month.toString().padLeft(2, '0')}-${d.day.toString().padLeft(2, '0')}';

  DateTime _dateOnly(DateTime d) => DateTime(d.year, d.month, d.day);

  DateTime _mondayOfWeek(DateTime d) {
    final base = _dateOnly(d);
    return base.subtract(Duration(days: base.weekday - 1));
  }

  String _dayHeaderLabel(DateTime d) {
    const weekNames = <int, String>{
      DateTime.monday: 'Thứ 2',
      DateTime.tuesday: 'Thứ 3',
      DateTime.wednesday: 'Thứ 4',
      DateTime.thursday: 'Thứ 5',
      DateTime.friday: 'Thứ 6',
      DateTime.saturday: 'Thứ 7',
      DateTime.sunday: 'Chủ nhật',
    };
    final week = weekNames[d.weekday] ?? '';
    return '$week, ${d.day} Thg ${d.month}';
  }

  @override
  void initState() {
    super.initState();
    _selectedDate = _dateOnly(DateTime.now());
    _weekStart = _mondayOfWeek(_selectedDate);
    _load();

    // Auto refresh so new bookings appear without reopening the screen.
    _pollTimer = Timer.periodic(const Duration(seconds: 4), (_) {
      if (!mounted) return;
      // Avoid overlap calls when _load is already running.
      if (_loading) return;
      _load();
    });
  }

  Future<void> _load() async {
    if (!mounted) return;
    setState(() => _loading = true);
    try {
      final userId = AppSession.userId ?? 0;
      if (userId <= 0) {
        throw Exception('Missing AppSession.userId');
      }

      final barber = await ApiService.getBarberByUserId(userId);

      // Debug: log userId and barber row to verify stability
      try {
        debugPrint('WorkSchedule: AppSession.userId=$userId');
        debugPrint('WorkSchedule: barber row => $barber');
      } catch (_) {}

      final barberId = (barber['barber_id'] as num?)?.toInt() ?? 0;
      if (barberId <= 0) {
        throw Exception('barber_id không hợp lệ');
      }

      final appts = await ApiService.getBarberAppointments(barberId);
      // Temporary debug logs to help investigate schedule reset issue
      try {
        // Use debugPrint to avoid truncation in release builds' consoles
        debugPrint(
          'WorkSchedule: loaded ${appts.length} appointments for barberId=$barberId',
        );
        if (appts.isNotEmpty) {
          debugPrint('WorkSchedule: first appt sample: ${appts[0]}');
        }
      } catch (_) {}

      setState(() {
        _appointments = appts;
        _loading = false;
      });
    } catch (e) {
      if (mounted) {
        // Log error for debugging
        debugPrint('WorkSchedule: _load error => $e');
        setState(() {
          _error = e.toString();
          _loading = false;
        });
      }
    }
  }

  Future<void> _refreshSchedule() async {
    await _load();
  }

  @override
  Widget build(BuildContext context) {
    final todayIso = _fmtDate(_selectedDate);
    final dayAppointments = _appointments
        .where((a) {
          final date = a['appt_date']?.toString();
          if (date != todayIso) return false;
          final status = a['status']?.toString() ?? '';
          // Lịch đã hoàn thành/đã hủy không hiển thị ở màn Lịch làm việc.
          return status != 'completed' &&
              status != 'paid_and_done' &&
              status != 'cancelled';
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
                _buildHorizontalCalendar(),
                Expanded(
                  child: RefreshIndicator(
                    onRefresh: _refreshSchedule,
                    color: const Color(0xffffc107),
                    child: Padding(
                      padding: const EdgeInsets.all(16),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Row(
                            mainAxisAlignment: MainAxisAlignment.spaceBetween,
                            children: [
                              Text(
                                _dayHeaderLabel(_selectedDate),
                                style: TextStyle(
                                  fontSize: 18,
                                  fontWeight: FontWeight.bold,
                                ),
                              ),
                              const Icon(
                                Icons.add,
                                size: 28,
                                color: Color(0xffffa000),
                              ),
                            ],
                          ),
                          const SizedBox(height: 15),
                          Expanded(
                            child: _loading
                                ? ListView(
                                    physics:
                                        const AlwaysScrollableScrollPhysics(),
                                    children: const [
                                      SizedBox(height: 8),
                                      Padding(
                                        padding: EdgeInsets.symmetric(
                                          horizontal: 16,
                                        ),
                                        child: SkeletonScheduleList(),
                                      ),
                                    ],
                                  )
                                : _error != null
                                ? ListView(
                                    physics:
                                        const AlwaysScrollableScrollPhysics(),
                                    children: [
                                      Center(child: Text('Lỗi: $_error')),
                                    ],
                                  )
                                : dayAppointments.isEmpty
                                ? ListView(
                                    physics:
                                        const AlwaysScrollableScrollPhysics(),
                                    children: const [
                                      SizedBox(height: 120),
                                      Center(
                                        child: Text('Không có lịch hôm nay'),
                                      ),
                                    ],
                                  )
                                : ListView.builder(
                                    physics:
                                        const AlwaysScrollableScrollPhysics(),
                                    itemCount: dayAppointments.length,
                                    itemBuilder: (context, index) {
                                      final a =
                                          dayAppointments[index]
                                              as Map<String, dynamic>;
                                      return Padding(
                                        padding: const EdgeInsets.only(
                                          bottom: 10,
                                        ),
                                        child: AppointmentCard(
                                          customerName:
                                              a['customer_name']?.toString() ??
                                              a['customer_full_name']
                                                  ?.toString() ??
                                              '---',
                                          time:
                                              a['start_time']?.toString() ?? '',
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
                                          showReviewButton: false,
                                          onTap: () {
                                            Navigator.push(
                                              context,
                                              CupertinoPageRoute(
                                                builder: (_) =>
                                                    AppointmentDetailScreen(
                                                      appointment: a,
                                                    ),
                                              ),
                                            );
                                          },
                                        ),
                                      );
                                    },
                                  ),
                          ),
                        ],
                      ),
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

  @override
  void dispose() {
    _pollTimer?.cancel();
    super.dispose();
  }

  Widget _buildHeader() {
    return Container(
      width: double.infinity,
      color: const Color(0xffffc107),
      padding: const EdgeInsets.fromLTRB(16, 8, 16, 12),
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
              child: Icon(
                Icons.calendar_today_outlined,
                color: Color(0xffffc107),
                size: 28,
              ),
            ),
          ),
          const SizedBox(width: 12),
          const Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  'Lịch làm việc',
                  style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold),
                ),
                Text('Haircut Booking — Thợ', style: TextStyle(fontSize: 12)),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildHorizontalCalendar() {
    final weekDates = List.generate(
      7,
      (index) => _weekStart.add(Duration(days: index)),
    );
    const weekLabels = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

    return Container(
      padding: const EdgeInsets.symmetric(vertical: 10),
      color: Colors.white,
      child: Column(
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceAround,
            children: weekLabels
                .map(
                  (label) => Text(
                    label,
                    style: const TextStyle(color: Colors.grey, fontSize: 12),
                  ),
                )
                .toList(),
          ),
          const SizedBox(height: 5),
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceAround,
            children: [
              IconButton(
                onPressed: () {
                  setState(() {
                    _weekStart = _weekStart.subtract(const Duration(days: 7));
                  });
                },
                icon: const Icon(Icons.chevron_left, color: Colors.grey),
              ),
              ...List.generate(7, (index) {
                final date = weekDates[index];
                final isSelected =
                    date.year == _selectedDate.year &&
                    date.month == _selectedDate.month &&
                    date.day == _selectedDate.day;
                return InkWell(
                  onTap: () => setState(() => _selectedDate = date),
                  borderRadius: BorderRadius.circular(999),
                  child: Container(
                    width: 40,
                    height: 40,
                    alignment: Alignment.center,
                    decoration: BoxDecoration(
                      color: isSelected ? const Color(0xffffc107) : null,
                      shape: BoxShape.circle,
                    ),
                    child: Text(
                      '${date.day}',
                      style: TextStyle(
                        fontSize: 18,
                        fontWeight: FontWeight.bold,
                        color: isSelected ? Colors.black87 : Colors.black,
                      ),
                    ),
                  ),
                );
              }),
              IconButton(
                onPressed: () {
                  setState(() {
                    _weekStart = _weekStart.add(const Duration(days: 7));
                  });
                },
                icon: const Icon(Icons.chevron_right, color: Colors.grey),
              ),
            ],
          ),
        ],
      ),
    );
  }
}
