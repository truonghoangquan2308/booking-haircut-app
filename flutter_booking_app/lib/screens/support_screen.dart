// lib/screens/support_screen.dart
import 'package:flutter/material.dart';
import 'package:url_launcher/url_launcher.dart';
import 'package:flutter_booking_app/screens/branch_chat_screen.dart';
import 'package:flutter_booking_app/services/api_service.dart';

class SupportScreen extends StatefulWidget {
  const SupportScreen({super.key});
  @override
  State<SupportScreen> createState() => _SupportScreenState();
}

class _SupportScreenState extends State<SupportScreen> {
  int? _expandedIndex;
  bool _loadingBranches = false;
  String? _branchesError;
  List<Map<String, dynamic>> _branches = [];

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
  void initState() {
    super.initState();
    _fetchBranches();
  }

  Future<void> _fetchBranches() async {
    setState(() {
      _loadingBranches = true;
      _branchesError = null;
    });
    try {
      final list = await ApiService.getBranches();
      setState(() {
        _branches = list;
      });
    } catch (e) {
      setState(() {
        _branchesError = e.toString();
      });
    } finally {
      if (mounted) {
        setState(() {
          _loadingBranches = false;
        });
      }
    }
  }

  String _branchName(Map<String, dynamic> branch) {
    return branch['name']?.toString().trim() ?? 'Chi nhánh';
  }

  String _branchPhone(Map<String, dynamic> branch) {
    return branch['phone']?.toString().trim() ?? 'Chưa có số';
  }

  String _branchAddress(Map<String, dynamic> branch) {
    return branch['address']?.toString().trim() ?? 'Chưa có địa chỉ';
  }

  Future<void> _launchPhone(String phone) async {
    final uri = Uri(scheme: 'tel', path: phone);
    if (await canLaunchUrl(uri)) {
      await launchUrl(uri);
    } else {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Không thể mở ứng dụng gọi điện.')),
      );
    }
  }

  Widget _buildBranchCard(Map<String, dynamic> branch) {
    return Container(
      margin: const EdgeInsets.only(bottom: 12),
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(16),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withValues(alpha: 0.04),
            blurRadius: 10,
            offset: const Offset(0, 3),
          ),
        ],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            _branchName(branch),
            style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 15),
          ),
          const SizedBox(height: 4),
          Text(_branchAddress(branch), style: const TextStyle(fontSize: 13)),
          const SizedBox(height: 4),
          Row(
            children: [
              const Icon(Icons.phone, size: 16, color: Colors.black54),
              const SizedBox(width: 6),
              Text(
                _branchPhone(branch),
                style: const TextStyle(fontSize: 13, color: Colors.black87),
              ),
            ],
          ),
          const SizedBox(height: 10),
          Row(
            children: [
              Expanded(
                child: OutlinedButton(
                  onPressed: () => Navigator.push(
                    context,
                    MaterialPageRoute(
                      builder: (_) => BranchChatScreen(branch: branch),
                    ),
                  ),
                  style: OutlinedButton.styleFrom(
                    foregroundColor: const Color(0xffffa000),
                    side: const BorderSide(color: Color(0xffffa000)),
                    shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(12),
                    ),
                  ),
                  child: const Text('Nhắn tin'),
                ),
              ),
              const SizedBox(width: 10),
              Expanded(
                child: ElevatedButton(
                  onPressed: () => _launchPhone(_branchPhone(branch)),
                  style: ElevatedButton.styleFrom(
                    backgroundColor: Colors.black,
                    shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(12),
                    ),
                  ),
                  child: const Text('Gọi chi nhánh'),
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }

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
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: const [
                        Text(
                          'Hotline hỗ trợ',
                          style: TextStyle(fontWeight: FontWeight.bold),
                        ),
                        SizedBox(height: 4),
                        Text('1800 1234 - Miễn phí 24/7'),
                      ],
                    ),
                  ),
                  ElevatedButton(
                    onPressed: () => _launchPhone('18001234'),
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
              'Liên hệ chi nhánh',
              style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold),
            ),
            const SizedBox(height: 10),
            if (_loadingBranches)
              const Center(child: CircularProgressIndicator())
            else if (_branchesError != null)
              Text('Lỗi tải chi nhánh: $_branchesError')
            else if (_branches.isEmpty)
              const Text('Chưa có chi nhánh để hiển thị. Vui lòng thử lại sau.')
            else
              ..._branches.map(_buildBranchCard),
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
