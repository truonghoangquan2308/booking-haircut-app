// lib/screens/support_screen.dart
import 'package:flutter/material.dart';

class SupportScreen extends StatefulWidget {
  const SupportScreen({super.key});
  @override
  State<SupportScreen> createState() => _SupportScreenState();
}

class _SupportScreenState extends State<SupportScreen> {
  int? _expandedIndex;

  final _faqs = const [
    {
      'q': 'Làm thế nào để đặt lịch cắt tóc?',
      'a':
          'Vào tab Đặt lịch → chọn dịch vụ → chọn thợ → chọn ngày giờ → xác nhận.',
    },
    {
      'q': 'Tôi có thể hủy lịch hẹn không?',
      'a': 'Có, bạn có thể hủy lịch trước 2 tiếng trong mục Đặt Lịch Của Tôi.',
    },
    {
      'q': 'Thanh toán bằng hình thức nào?',
      'a': 'Hiện tại chúng tôi hỗ trợ thanh toán tiền mặt tại cửa hàng.',
    },
    {
      'q': 'Điểm tích lũy dùng để làm gì?',
      'a': 'Điểm tích lũy có thể đổi thành các ưu đãi giảm giá dịch vụ.',
    },
    {
      'q': 'Thợ có đến tận nơi không?',
      'a': 'Hiện tại chưa hỗ trợ, bạn cần đến trực tiếp cửa hàng.',
    },
  ];

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xfff4f5f9),
      appBar: AppBar(
        backgroundColor: const Color(0xffffc107),
        title: const Text(
          'Hỗ trợ & FAQ',
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
            // Liên hệ nhanh
            Container(
              padding: const EdgeInsets.all(16),
              decoration: BoxDecoration(
                color: const Color(0xffffc107),
                borderRadius: BorderRadius.circular(16),
              ),
              child: Row(
                children: [
                  const Icon(Icons.headset_mic, size: 32),
                  const SizedBox(width: 12),
                  const Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          'Hotline hỗ trợ',
                          style: TextStyle(fontWeight: FontWeight.bold),
                        ),
                        Text('1800 1234 - Miễn phí 24/7'),
                      ],
                    ),
                  ),
                  ElevatedButton(
                    onPressed: () {},
                    style: ElevatedButton.styleFrom(
                      backgroundColor: Colors.black,
                      shape: RoundedRectangleBorder(
                        borderRadius: BorderRadius.circular(10),
                      ),
                    ),
                    child: const Text(
                      'Gọi ngay',
                      style: TextStyle(color: Colors.white),
                    ),
                  ),
                ],
              ),
            ),
            const SizedBox(height: 20),
            const Text(
              'Câu hỏi thường gặp',
              style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold),
            ),
            const SizedBox(height: 12),
            ..._faqs.asMap().entries.map((e) {
              final i = e.key;
              final faq = e.value;
              final expanded = _expandedIndex == i;
              return Container(
                margin: const EdgeInsets.only(bottom: 8),
                decoration: BoxDecoration(
                  color: Colors.white,
                  borderRadius: BorderRadius.circular(14),
                  boxShadow: [
                    BoxShadow(
                      color: Colors.black.withValues(alpha: 0.05),
                      blurRadius: 6,
                    ),
                  ],
                ),
                child: ListTile(
                  title: Text(
                    faq['q']!,
                    style: const TextStyle(fontWeight: FontWeight.w600),
                  ),
                  subtitle: expanded
                      ? Padding(
                          padding: const EdgeInsets.only(top: 8),
                          child: Text(faq['a']!),
                        )
                      : null,
                  trailing: Icon(
                    expanded ? Icons.expand_less : Icons.expand_more,
                    color: const Color(0xffffc107),
                  ),
                  onTap: () =>
                      setState(() => _expandedIndex = expanded ? null : i),
                ),
              );
            }),
          ],
        ),
      ),
    );
  }
}
