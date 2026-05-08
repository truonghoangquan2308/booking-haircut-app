import 'package:flutter/material.dart';
import 'package:flutter_booking_app/services/api_service.dart';

class AppointmentDetailScreen extends StatefulWidget {
  const AppointmentDetailScreen({super.key, required this.appointment});

  final Map<String, dynamic> appointment;

  @override
  State<AppointmentDetailScreen> createState() =>
      _AppointmentDetailScreenState();
}

class _AppointmentDetailScreenState extends State<AppointmentDetailScreen> {
  bool _busy = false;

  String _statusText(String? status, String customerName) {
    switch (status) {
      case 'pending':
        return 'Chưa bắt đầu';
      case 'confirmed':
        return 'Đã xác nhận';
      case 'in_progress':
        return 'Đang làm cho: $customerName';
      case 'completed':
        return 'Đã hoàn thành';
      case 'cancelled':
        return 'Đã huỷ';
      default:
        return status ?? 'pending';
    }
  }

  Future<void> _updateStatus(String status) async {
    if (_busy) return;
    final appointmentId = (widget.appointment['id'] as num?)?.toInt() ?? 0;
    if (appointmentId <= 0) return;

    setState(() => _busy = true);
    try {
      await ApiService.updateAppointmentStatus(
        appointmentId: appointmentId,
        status: status,
      );
      if (!mounted) return;
      Navigator.of(context).pop(true);
    } catch (_) {
      if (!mounted) return;
      ScaffoldMessenger.of(
        context,
      ).showSnackBar(const SnackBar(content: Text('Lỗi cập nhật trạng thái')));
    } finally {
      if (mounted) {
        setState(() => _busy = false);
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final appt = widget.appointment;
    final status = appt['status']?.toString();
    final customerName =
        appt['customer_name']?.toString() ??
        appt['customer_full_name']?.toString() ??
        '---';
    final serviceName = appt['service_name']?.toString() ?? '---';
    final startTime = appt['start_time']?.toString() ?? '';
    final endTime = appt['end_time']?.toString() ?? '';
    final apptDate = appt['appt_date']?.toString() ?? '';
    final totalPrice = appt['total_price']?.toString() ?? '';
    final note = appt['note']?.toString().trim();
    final noteLabel = (note == null || note.isEmpty)
        ? 'Không có ghi chú'
        : note;

    return Scaffold(
      backgroundColor: const Color(0xfff4f5f9),
      appBar: AppBar(
        backgroundColor: const Color(0xffffc107),
        foregroundColor: Colors.black87,
        elevation: 0,
        title: const Text(
          'Chi tiết lịch hẹn',
          style: TextStyle(fontWeight: FontWeight.bold),
        ),
      ),
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Container(
              width: double.infinity,
              padding: const EdgeInsets.all(20),
              decoration: BoxDecoration(
                color: Colors.white,
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
                children: [
                  _buildInfoRow('Khách hàng:', customerName),
                  Divider(height: 24, color: Colors.grey.shade100),
                  _buildInfoRow(
                    'Số điện thoại:',
                    appt['customer_phone']?.toString() ?? '—',
                  ),
                  Divider(height: 24, color: Colors.grey.shade100),
                  _buildInfoRow(
                    'Thời gian:',
                    startTime.isNotEmpty && endTime.isNotEmpty
                        ? '$startTime - $endTime ($apptDate)'
                        : apptDate,
                  ),
                  Divider(height: 24, color: Colors.grey.shade100),
                  _buildInfoRow('Dịch vụ:', serviceName),
                  Divider(height: 24, color: Colors.grey.shade100),
                  _buildInfoRow('Giá:', totalPrice),
                ],
              ),
            ),
            const SizedBox(height: 16),
            Container(
              width: double.infinity,
              padding: const EdgeInsets.all(20),
              decoration: BoxDecoration(
                color: Colors.white,
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
                  const Text(
                    'Ghi chú',
                    style: TextStyle(fontWeight: FontWeight.bold, fontSize: 16),
                  ),
                  const SizedBox(height: 8),
                  Text(
                    noteLabel,
                    style: TextStyle(color: Colors.grey.shade700),
                  ),
                  const SizedBox(height: 12),
                  Container(
                    padding: const EdgeInsets.symmetric(
                      horizontal: 16,
                      vertical: 6,
                    ),
                    decoration: BoxDecoration(
                      color: Colors.orange.shade50,
                      borderRadius: BorderRadius.circular(20),
                    ),
                    child: Text(
                      _statusText(status, customerName),
                      style: TextStyle(
                        color: Colors.orange.shade900,
                        fontWeight: FontWeight.bold,
                      ),
                    ),
                  ),
                ],
              ),
            ),
            const SizedBox(height: 24),
            if (status == 'pending' || status == 'confirmed')
              SizedBox(
                width: double.infinity,
                child: ElevatedButton(
                  onPressed: _busy ? null : () => _updateStatus('in_progress'),
                  style: ElevatedButton.styleFrom(
                    backgroundColor: const Color(0xffffc107),
                    foregroundColor: Colors.black87,
                    minimumSize: const Size(double.infinity, 50),
                    shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(15),
                    ),
                  ),
                  child: const Text(
                    'Bắt đầu dịch vụ',
                    style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold),
                  ),
                ),
              ),
            if (status == 'pending' || status == 'confirmed')
              const SizedBox(height: 10),
            if (status == 'pending' ||
                status == 'confirmed' ||
                status == 'in_progress')
              Row(
                children: [
                  if (status == 'in_progress')
                    Expanded(
                      child: ElevatedButton(
                        onPressed: _busy
                            ? null
                            : () => _updateStatus('completed'),
                        style: ElevatedButton.styleFrom(
                          backgroundColor: Colors.white,
                          foregroundColor: Colors.black87,
                          minimumSize: const Size(double.infinity, 50),
                          shape: RoundedRectangleBorder(
                            borderRadius: BorderRadius.circular(15),
                          ),
                        ),
                        child: const Text(
                          'Hoàn thành',
                          style: TextStyle(fontWeight: FontWeight.bold),
                        ),
                      ),
                    ),
                  if (status == 'in_progress') const SizedBox(width: 10),
                  Expanded(
                    child: OutlinedButton(
                      onPressed: _busy
                          ? null
                          : () => _updateStatus('cancelled'),
                      style: OutlinedButton.styleFrom(
                        backgroundColor: Colors.white,
                        minimumSize: const Size(double.infinity, 50),
                        shape: RoundedRectangleBorder(
                          borderRadius: BorderRadius.circular(15),
                        ),
                        side: BorderSide(color: Colors.grey.shade300),
                      ),
                      child: const Text(
                        'Huỷ lịch',
                        style: TextStyle(
                          color: Color(0xffffa000),
                          fontWeight: FontWeight.bold,
                        ),
                      ),
                    ),
                  ),
                ],
              ),
          ],
        ),
      ),
    );
  }

  Widget _buildInfoRow(String label, String value) {
    return Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        SizedBox(
          width: 120,
          child: Text(
            label,
            style: TextStyle(color: Colors.grey.shade600, fontSize: 14),
          ),
        ),
        Expanded(
          child: Text(
            value,
            style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 16),
          ),
        ),
      ],
    );
  }
}
