import 'package:flutter/material.dart';
import 'package:flutter_booking_app/app_session.dart';
import 'package:flutter_booking_app/services/api_service.dart';

class CustomerReviewsScreen extends StatefulWidget {
  const CustomerReviewsScreen({super.key});

  @override
  State<CustomerReviewsScreen> createState() => _CustomerReviewsScreenState();
}

class _CustomerReviewsScreenState extends State<CustomerReviewsScreen> {
  late Future<List<Map<String, dynamic>>> _reviewsFuture;

  @override
  void initState() {
    super.initState();
    _reviewsFuture = _loadReviews();
  }

  Future<List<Map<String, dynamic>>> _loadReviews() async {
    final userId = AppSession.userId ?? 0;
    if (userId <= 0) return const <Map<String, dynamic>>[];

    Map<String, dynamic> barber;
    try {
      barber = await ApiService.getBarberByUserId(userId);
    } catch (_) {
      return const <Map<String, dynamic>>[];
    }

    final barberId = (barber['barber_id'] as num?)?.toInt() ??
        (barber['id'] as num?)?.toInt() ??
        0;
    final filtered = await ApiService.getReviewsByBarber(barberId);

    filtered.sort((a, b) {
      final da = a['created_at']?.toString() ?? '';
      final db = b['created_at']?.toString() ?? '';
      return db.compareTo(da);
    });

    return filtered;
  }

  String _dateLabel(String raw) {
    final d = DateTime.tryParse(raw);
    if (d == null) return raw;
    return '${d.day.toString().padLeft(2, '0')}/${d.month.toString().padLeft(2, '0')}/${d.year}';
  }

  String _normalizeAvatarUrl(String? raw) {
    return ApiService.resolveMediaUrl(raw) ?? '';
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xfff4f5f9),
      appBar: AppBar(
        backgroundColor: const Color(0xffffc107),
        foregroundColor: Colors.black,
        title: const Text(
          'Đánh giá của khách',
          style: TextStyle(fontWeight: FontWeight.bold),
        ),
      ),
      body: FutureBuilder<List<Map<String, dynamic>>>(
        future: _reviewsFuture,
        builder: (context, snapshot) {
          if (snapshot.connectionState == ConnectionState.waiting) {
            return const Center(child: CircularProgressIndicator());
          }
          if (snapshot.hasError) {
            return Center(
              child: Padding(
                padding: const EdgeInsets.all(20),
                child: Text(
                  'Chưa tải được danh sách đánh giá.\n${snapshot.error}',
                  textAlign: TextAlign.center,
                ),
              ),
            );
          }

          final reviews = snapshot.data ?? const <Map<String, dynamic>>[];
          if (reviews.isEmpty) {
            return const Center(child: Text('Chưa có đánh giá nào'));
          }

          final total = reviews.length;
          final sum = reviews.fold<double>(
            0,
            (acc, e) => acc + (double.tryParse(e['rating']?.toString() ?? '') ?? 0),
          );
          final avg = total == 0 ? 0 : (sum / total);

          return ListView(
            padding: const EdgeInsets.all(16),
            children: [
              Container(
                margin: const EdgeInsets.only(bottom: 14),
                padding: const EdgeInsets.all(14),
                decoration: BoxDecoration(
                  color: Colors.white,
                  borderRadius: BorderRadius.circular(14),
                ),
                child: Row(
                  children: [
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          const Text(
                            'Tổng quan đánh giá',
                            style: TextStyle(fontWeight: FontWeight.w700),
                          ),
                          const SizedBox(height: 6),
                          Text(
                            '${avg.toStringAsFixed(1)} / 5.0',
                            style: const TextStyle(
                              fontSize: 24,
                              fontWeight: FontWeight.w800,
                            ),
                          ),
                          const SizedBox(height: 4),
                          Row(
                            children: List.generate(
                              5,
                              (i) => Icon(
                                i < avg.round() ? Icons.star : Icons.star_border,
                                color: const Color(0xffffc107),
                                size: 18,
                              ),
                            ),
                          ),
                        ],
                      ),
                    ),
                    Container(
                      padding: const EdgeInsets.symmetric(
                        horizontal: 14,
                        vertical: 10,
                      ),
                      decoration: BoxDecoration(
                        color: const Color(0xffffc107).withValues(alpha: 0.15),
                        borderRadius: BorderRadius.circular(999),
                      ),
                      child: Text(
                        '$total lượt',
                        style: const TextStyle(fontWeight: FontWeight.w700),
                      ),
                    ),
                  ],
                ),
              ),
              ...List.generate(reviews.length, (index) {
              final r = reviews[index];
              final rating = int.tryParse(r['rating']?.toString() ?? '0') ?? 0;
              final comment = (r['comment'] ?? '').toString().trim();
              final customerName =
                  (r['customer_name'] ?? r['customer_full_name'] ?? 'Khách hàng')
                      .toString();
              final createdAt = _dateLabel(r['created_at']?.toString() ?? '');
              final avatarUrl = _normalizeAvatarUrl(
                r['customer_avatar_url']?.toString(),
              );
              return Container(
                margin: const EdgeInsets.only(bottom: 12),
                padding: const EdgeInsets.all(14),
                decoration: BoxDecoration(
                  color: Colors.white,
                  borderRadius: BorderRadius.circular(14),
                ),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      children: [
                        CircleAvatar(
                          radius: 20,
                          backgroundColor: const Color(0xffffc107),
                          backgroundImage:
                              avatarUrl.isEmpty ? null : NetworkImage(avatarUrl),
                          child: avatarUrl.isEmpty
                              ? Text(
                                  customerName.isEmpty ? '?' : customerName[0],
                                  style: const TextStyle(
                                    color: Colors.white,
                                    fontWeight: FontWeight.w700,
                                  ),
                                )
                              : null,
                        ),
                        const SizedBox(width: 10),
                        Expanded(
                          child: Text(
                            customerName,
                            style: const TextStyle(fontWeight: FontWeight.w700),
                          ),
                        ),
                        Text(
                          createdAt,
                          style: const TextStyle(fontSize: 12, color: Colors.grey),
                        ),
                      ],
                    ),
                    const SizedBox(height: 8),
                    Row(
                      children: List.generate(
                        5,
                        (i) => Icon(
                          i < rating ? Icons.star : Icons.star_border,
                          color: const Color(0xffffc107),
                          size: 20,
                        ),
                      ),
                    ),
                    const SizedBox(height: 8),
                    Container(
                      width: double.infinity,
                      padding: const EdgeInsets.all(10),
                      decoration: BoxDecoration(
                        color: const Color(0xfff4f5f9),
                        borderRadius: BorderRadius.circular(10),
                      ),
                      child: Text(comment.isEmpty ? 'Không có nhận xét' : comment),
                    ),
                  ],
                ),
              );
              }),
              const SizedBox(height: 80),
            ],
          );
        },
      ),
    );
  }
}
