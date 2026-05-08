// lib/screens/review_screen.dart
import 'package:flutter/material.dart';
import 'package:flutter_booking_app/services/api_service.dart';

class ReviewScreen extends StatefulWidget {
  final String barberName;
  final String serviceName;
  final int? appointmentId;
  final int? customerId;
  final int? barberId;
  final Map<String, dynamic>? existingReview;
  final bool readOnly;

  const ReviewScreen({
    super.key,
    required this.barberName,
    required this.serviceName,
    this.appointmentId,
    this.customerId,
    this.barberId,
    this.existingReview,
    this.readOnly = false,
  });

  @override
  State<ReviewScreen> createState() => _ReviewScreenState();
}

class _ReviewScreenState extends State<ReviewScreen> {
  int _rating = 0;
  final _commentController = TextEditingController();
  bool _busy = false;

  @override
  void initState() {
    super.initState();
    final existing = widget.existingReview;
    if (existing != null) {
      _rating = int.tryParse(existing['rating']?.toString() ?? '0') ?? 0;
      _commentController.text = (existing['comment'] ?? '').toString();
    }
  }

  @override
  void dispose() {
    _commentController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xfff4f5f9),
      appBar: AppBar(
        backgroundColor: const Color(0xffffc107),
        title: const Text(
          'Đánh Giá Dịch vụ Cắt Tóc',
          style: TextStyle(fontWeight: FontWeight.bold),
        ),
        foregroundColor: Colors.black,
        elevation: 0,
      ),
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(16),
        child: Column(
          children: [
            Container(
              width: double.infinity,
              padding: const EdgeInsets.all(20),
              decoration: BoxDecoration(
                color: Colors.white,
                borderRadius: BorderRadius.circular(16),
                boxShadow: [
                  BoxShadow(
                    color: Colors.black.withValues(alpha: 0.05),
                    blurRadius: 8,
                    offset: const Offset(0, 4),
                  ),
                ],
              ),
              child: Column(
                children: [
                  const Text(
                    'Đánh Giá Chất Lượng',
                    style: TextStyle(fontWeight: FontWeight.bold, fontSize: 18),
                  ),
                  const SizedBox(height: 16),
                  CircleAvatar(
                    radius: 36,
                    backgroundColor: const Color(0xffffc107),
                    child: Text(
                      widget.barberName[0],
                      style: const TextStyle(
                        fontSize: 28,
                        fontWeight: FontWeight.bold,
                        color: Colors.white,
                      ),
                    ),
                  ),
                  const SizedBox(height: 8),
                  Text(
                    widget.barberName,
                    style: const TextStyle(
                      fontWeight: FontWeight.bold,
                      fontSize: 16,
                    ),
                  ),
                  Text(
                    widget.serviceName,
                    style: TextStyle(color: Colors.grey.shade600),
                  ),
                  const SizedBox(height: 20),
                  Row(
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: List.generate(5, (index) {
                      return GestureDetector(
                        onTap: widget.readOnly
                            ? null
                            : () => setState(() => _rating = index + 1),
                        child: Icon(
                          index < _rating ? Icons.star : Icons.star_border,
                          color: const Color(0xffffc107),
                          size: 36,
                        ),
                      );
                    }),
                  ),
                  const SizedBox(height: 20),
                  TextField(
                    controller: _commentController,
                    maxLines: 4,
                    enabled: !widget.readOnly,
                    decoration: InputDecoration(
                      hintText: 'Viết Nhận Xét ...',
                      filled: true,
                      fillColor: const Color(0xfff5f5f7),
                      border: OutlineInputBorder(
                        borderRadius: BorderRadius.circular(12),
                        borderSide: BorderSide.none,
                      ),
                    ),
                  ),
                  const SizedBox(height: 20),
                  SizedBox(
                    width: double.infinity,
                    child: ElevatedButton(
                      onPressed: widget.readOnly
                          ? () => Navigator.pop(context)
                          : _rating == 0
                          ? null
                          : () {
                              _submitReview();
                            },
                      style: ElevatedButton.styleFrom(
                        backgroundColor: const Color(0xffffc107),
                        disabledBackgroundColor: Colors.grey.shade300,
                        padding: const EdgeInsets.symmetric(vertical: 14),
                        shape: RoundedRectangleBorder(
                          borderRadius: BorderRadius.circular(12),
                        ),
                      ),
                      child: Text(
                        widget.readOnly ? 'Đóng' : 'Gửi',
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
          ],
        ),
      ),
    );
  }

  Future<void> _submitReview() async {
    if (_busy) return;
    final appointmentId = widget.appointmentId;
    final customerId = widget.customerId;
    final barberId = widget.barberId;

    if (appointmentId == null || customerId == null || barberId == null) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Thiếu thông tin để gửi đánh giá')),
      );
      return;
    }

    setState(() => _busy = true);
    try {
      await ApiService.createReview(
        appointmentId: appointmentId,
        customerId: customerId,
        barberId: barberId,
        rating: _rating,
        comment: _commentController.text.trim().isEmpty
            ? null
            : _commentController.text.trim(),
      );
      if (!mounted) return;
      ScaffoldMessenger.of(
        context,
      ).showSnackBar(const SnackBar(content: Text('Cảm ơn bạn đã đánh giá!')));
      Navigator.pop(context);
    } catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(
        context,
      ).showSnackBar(SnackBar(content: Text('Gửi đánh giá thất bại: $e')));
    } finally {
      if (mounted) {
        setState(() => _busy = false);
      }
    }
  }
}
