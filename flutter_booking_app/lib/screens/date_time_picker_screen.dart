// lib/screens/date_time_picker_screen.dart
import 'package:flutter/material.dart';
import 'package:flutter_booking_app/app_session.dart';
import 'package:flutter_booking_app/services/api_service.dart';

class DateTimePickerScreen extends StatefulWidget {
  final int serviceId;
  final String serviceName;
  final double servicePriceValue;
  final int barberId;
  final String barberName;
  final String? note;
  final String? branchName;

  const DateTimePickerScreen({
    super.key,
    required this.serviceId,
    required this.serviceName,
    required this.servicePriceValue,
    required this.barberId,
    required this.barberName,
    this.note,
    this.branchName,
  });

  @override
  State<DateTimePickerScreen> createState() => _DateTimePickerScreenState();
}

class _DateTimePickerScreenState extends State<DateTimePickerScreen> {
  DateTime _selectedDate = DateTime.now();
  int? _selectedTimeSlotId;

  String _fmtMoney(double v) {
    if (v >= 1e6) {
      final x = v / 1e6;
      return '${x % 1 == 0 ? x.toStringAsFixed(0) : x.toStringAsFixed(1)}tr';
    }
    if (v >= 1e3) {
      final x = v / 1e3;
      return '${x % 1 == 0 ? x.toStringAsFixed(0) : x.toStringAsFixed(1)}k';
    }
    return '${v.round()}đ';
  }

  bool _loadingSlots = false;
  String? _slotsError;
  List<dynamic> _slots = [];

  String _fmtDate(DateTime d) =>
      '${d.year}-${d.month.toString().padLeft(2, '0')}-${d.day.toString().padLeft(2, '0')}';

  @override
  void initState() {
    super.initState();
    _loadSlots();
  }

  Future<void> _loadSlots() async {
    setState(() {
      _loadingSlots = true;
      _slotsError = null;
      _selectedTimeSlotId = null;
      _slots = [];
    });

    try {
      final slots = await ApiService.getTimeSlots(
        barberId: widget.barberId,
        date: _fmtDate(_selectedDate),
      );

      // Only show free slots.
      final available = slots
          .where((s) {
            final v = s['is_booked'];
            return v == 0 || v == '0' || v == null;
          })
          .toList(growable: false);

      setState(() {
        _slots = available;
        _loadingSlots = false;
      });
    } catch (e) {
      setState(() {
        _slotsError = e.toString();
        _loadingSlots = false;
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xfff4f5f9),
      appBar: AppBar(
        backgroundColor: const Color(0xffffc107),
        title: const Text(
          'Chọn Ngày và Giờ',
          style: TextStyle(fontWeight: FontWeight.bold),
        ),
        foregroundColor: Colors.black,
        elevation: 0,
      ),
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // Thông tin dịch vụ
            Container(
              padding: const EdgeInsets.all(14),
              decoration: BoxDecoration(
                color: Colors.white,
                borderRadius: BorderRadius.circular(16),
                boxShadow: [
                  BoxShadow(
                    color: Colors.black.withValues(alpha: 0.05),
                    blurRadius: 8,
                  ),
                ],
              ),
              child: Row(
                children: [
                  const Icon(Icons.content_cut, color: Color(0xffffc107)),
                  const SizedBox(width: 10),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        if (widget.branchName != null &&
                            widget.branchName!.trim().isNotEmpty) ...[
                          Text(
                            widget.branchName!.trim(),
                            style: TextStyle(
                              fontSize: 12,
                              color: Colors.grey.shade700,
                              fontWeight: FontWeight.w600,
                            ),
                          ),
                          const SizedBox(height: 4),
                        ],
                        Text(
                          widget.serviceName,
                          style: const TextStyle(fontWeight: FontWeight.bold),
                        ),
                      ],
                    ),
                  ),
                  Container(
                    padding: const EdgeInsets.symmetric(
                      horizontal: 10,
                      vertical: 4,
                    ),
                    decoration: BoxDecoration(
                      color: const Color(0xffffc107),
                      borderRadius: BorderRadius.circular(20),
                    ),
                    child: Text(
                      _fmtMoney(widget.servicePriceValue),
                      style: const TextStyle(fontWeight: FontWeight.bold),
                    ),
                  ),
                ],
              ),
            ),
            const SizedBox(height: 16),

            // Calendar
            Container(
              decoration: BoxDecoration(
                color: Colors.white,
                borderRadius: BorderRadius.circular(20),
                boxShadow: [
                  BoxShadow(
                    color: Colors.black.withValues(alpha: 0.05),
                    blurRadius: 8,
                  ),
                ],
              ),
              child: CalendarDatePicker(
                initialDate: _selectedDate,
                firstDate: DateTime.now(),
                lastDate: DateTime.now().add(const Duration(days: 30)),
                onDateChanged: (d) {
                  setState(() => _selectedDate = d);
                  _loadSlots();
                },
              ),
            ),
            const SizedBox(height: 20),

            // Time slots
            const Text(
              'Chọn giờ',
              style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold),
            ),
            const SizedBox(height: 12),
            if (_loadingSlots)
              const Padding(
                padding: EdgeInsets.symmetric(vertical: 20),
                child: Center(child: CircularProgressIndicator()),
              )
            else if (_slotsError != null)
              Text('Không tải được khung giờ: $_slotsError')
            else if (_slots.isEmpty)
              const Text('Không có khung giờ trống cho ngày này')
            else
              Wrap(
                spacing: 10,
                runSpacing: 10,
                children: _slots.map((slot) {
                  final id = (slot['id'] as num?)?.toInt();
                  final selected = _selectedTimeSlotId == id;
                  final start = slot['start_time']?.toString() ?? '';
                  final end = slot['end_time']?.toString() ?? '';
                  final label = (start.isNotEmpty && end.isNotEmpty)
                      ? '$start - $end'
                      : start;

                  return GestureDetector(
                    onTap: () => setState(() => _selectedTimeSlotId = id),
                    child: Container(
                      padding: const EdgeInsets.symmetric(
                        horizontal: 18,
                        vertical: 10,
                      ),
                      decoration: BoxDecoration(
                        color: selected
                            ? const Color(0xffffc107)
                            : Colors.white,
                        borderRadius: BorderRadius.circular(12),
                        border: Border.all(
                          color: selected
                              ? const Color(0xffffc107)
                              : Colors.grey.shade300,
                        ),
                        boxShadow: [
                          BoxShadow(
                            color: Colors.black.withValues(alpha: 0.04),
                            blurRadius: 6,
                          ),
                        ],
                      ),
                      child: Text(
                        label,
                        style: TextStyle(
                          fontWeight: FontWeight.bold,
                          color: selected ? Colors.black : Colors.black87,
                        ),
                      ),
                    ),
                  );
                }).toList(),
              ),
            const SizedBox(height: 32),

            // Confirm button
            SizedBox(
              width: double.infinity,
              child: ElevatedButton(
                onPressed: _selectedTimeSlotId != null
                    ? () => _confirmBooking()
                    : null,
                style: ElevatedButton.styleFrom(
                  backgroundColor: const Color(0xffffc107),
                  disabledBackgroundColor: Colors.grey.shade300,
                  padding: const EdgeInsets.symmetric(vertical: 14),
                  shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(14),
                  ),
                ),
                child: const Text(
                  'Xác Nhận',
                  style: TextStyle(
                    fontSize: 16,
                    fontWeight: FontWeight.bold,
                    color: Colors.black,
                  ),
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }

  Future<void> _confirmBooking() async {
    final customerId = AppSession.userId ?? 0;
    if (customerId <= 0) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Chưa xác định người đặt lịch')),
      );
      return;
    }

    final slot = _slots.firstWhere(
      (s) => (s['id'] as num?)?.toInt() == _selectedTimeSlotId,
      orElse: () => null,
    );

    if (slot == null) return;

    try {
      await ApiService.createAppointment(
        customerId: customerId,
        barberId: widget.barberId,
        serviceId: widget.serviceId,
        timeSlotId: (_selectedTimeSlotId as int),
        apptDate: _fmtDate(_selectedDate),
        startTime: slot['start_time']?.toString() ?? '',
        endTime: slot['end_time']?.toString() ?? '',
        totalPrice: widget.servicePriceValue,
        note: (widget.note ?? '').trim().isEmpty ? null : widget.note!.trim(),
      );

      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('Đặt lịch thành công: ${widget.serviceName}')),
      );
      Navigator.of(context).popUntil((route) => route.isFirst);
    } catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(
        context,
      ).showSnackBar(SnackBar(content: Text('Đặt lịch thất bại: $e')));
    }
  }
}
