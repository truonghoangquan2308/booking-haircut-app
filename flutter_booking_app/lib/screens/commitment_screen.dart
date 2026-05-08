import 'package:flutter/material.dart';

/// Cam kết chất lượng / dịch vụ (nội dung tĩnh).
class CommitmentScreen extends StatelessWidget {
  const CommitmentScreen({super.key});

  static const _items = [
    'Dụng cụ được khử trùng và thay mới theo tiêu chuẩn.',
    'Thợ được đào tạo, tư vấn kiểu tóc phù hợp trước khi làm.',
    'Không phát sinh chi phí ngoài niêm yết khi đã xác nhận dịch vụ.',
    'Hỗ trợ chỉnh sửa nhẹ trong 7 ngày nếu không hài lòng (theo chính sách cửa hàng).',
  ];

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xfff4f5f9),
      appBar: AppBar(
        backgroundColor: const Color(0xffffc107),
        foregroundColor: Colors.black87,
        elevation: 0,
        title: const Text(
          'Cam kết',
          style: TextStyle(fontWeight: FontWeight.bold),
        ),
      ),
      body: ListView(
        padding: const EdgeInsets.all(20),
        children: [
          Container(
            padding: const EdgeInsets.all(18),
            decoration: BoxDecoration(
              color: Colors.white,
              borderRadius: BorderRadius.circular(16),
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
                Row(
                  children: [
                    Icon(
                      Icons.verified,
                      color: Colors.orange.shade800,
                      size: 28,
                    ),
                    const SizedBox(width: 10),
                    const Expanded(
                      child: Text(
                        'Cam kết của GROUP 5',
                        style: TextStyle(
                          fontSize: 18,
                          fontWeight: FontWeight.bold,
                        ),
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 16),
                ..._items.map(
                  (t) => Padding(
                    padding: const EdgeInsets.only(bottom: 12),
                    child: Row(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        const Text('• ', style: TextStyle(fontSize: 18)),
                        Expanded(
                          child: Text(t, style: const TextStyle(height: 1.4)),
                        ),
                      ],
                    ),
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
