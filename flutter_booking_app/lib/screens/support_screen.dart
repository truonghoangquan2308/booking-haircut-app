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
  Map<String, dynamic>? _activeBranch;
  final _chatController = TextEditingController();
  final List<Map<String, String>> _chatMessages = [];

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
    _chatMessages.add({
      'sender': 'bot',
      'text':
          'Xin chào! Bạn có thể chọn chi nhánh cần liên hệ hoặc gửi tin nhắn để lễ tân hỗ trợ nhanh hơn.',
    });
  }

  @override
  void dispose() {
    _chatController.dispose();
    super.dispose();
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

  void _sendChatMessage(String text) {
    final message = text.trim();
    if (message.isEmpty) return;
    setState(() {
      _chatMessages.add({'sender': 'user', 'text': message});
      _chatController.clear();
    });

    final reply = _createBotReply(message);
    Future.delayed(const Duration(milliseconds: 300), () {
      if (!mounted) return;
      setState(() {
        _chatMessages.add({'sender': 'bot', 'text': reply});
      });
    });
  }

  String _createBotReply(String message) {
    final lower = message.toLowerCase();
    if (lower.contains('đặt') || lower.contains('lịch')) {
      return 'Bạn đang hỏi về đặt lịch. Hãy gửi thêm: dịch vụ, ngày và giờ bạn muốn nhé.';
    }
    if (lower.contains('hủy') || lower.contains('huỷ')) {
      return 'Bạn muốn hủy lịch. Vui lòng cung cấp mã đặt lịch hoặc ngày giờ để lễ tân kiểm tra.';
    }
    if (lower.contains('giá') || lower.contains('bao nhiêu')) {
      return 'Bạn muốn biết giá. Gửi tên dịch vụ hoặc chi nhánh để tôi giúp bạn nhanh hơn.';
    }
    if (lower.contains('khuyến mãi') || lower.contains('ưu đãi')) {
      return 'Hiện có ưu đãi cho khách mới và khách thân thiết. Bạn muốn tôi kiểm tra ưu đãi cho bạn không?';
    }
    return 'Cảm ơn bạn. Lễ tân sẽ xem và trả lời sớm nhất. Bạn có thể mô tả ngắn gọn vấn đề hoặc chọn chi nhánh bên trên.';
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

  Widget _buildChatArea() {
    return Container(
      padding: const EdgeInsets.all(16),
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
            _activeBranch != null
                ? 'Đang chat: ${_branchName(_activeBranch!)}'
                : 'Chat hỗ trợ nhanh',
            style: const TextStyle(fontSize: 16, fontWeight: FontWeight.bold),
          ),
          const SizedBox(height: 10),
          SizedBox(
            height: 220,
            child: ListView.builder(
              itemCount: _chatMessages.length,
              padding: EdgeInsets.zero,
              itemBuilder: (context, index) {
                final message = _chatMessages[index];
                final isUser = message['sender'] == 'user';
                return Align(
                  alignment: isUser
                      ? Alignment.centerRight
                      : Alignment.centerLeft,
                  child: Container(
                    margin: const EdgeInsets.symmetric(vertical: 6),
                    padding: const EdgeInsets.symmetric(
                      vertical: 12,
                      horizontal: 14,
                    ),
                    constraints: BoxConstraints(
                      maxWidth: MediaQuery.of(context).size.width * 0.75,
                    ),
                    decoration: BoxDecoration(
                      color: isUser
                          ? const Color(0xffffc107)
                          : const Color(0xfff2f3f7),
                      borderRadius: BorderRadius.circular(16),
                    ),
                    child: Text(
                      message['text'] ?? '',
                      style: TextStyle(
                        color: isUser ? Colors.black : Colors.black87,
                      ),
                    ),
                  ),
                );
              },
            ),
          ),
          const SizedBox(height: 10),
          Row(
            children: [
              Expanded(
                child: TextField(
                  controller: _chatController,
                  textInputAction: TextInputAction.send,
                  onSubmitted: _sendChatMessage,
                  decoration: InputDecoration(
                    hintText: 'Nhập câu hỏi của bạn...',
                    filled: true,
                    fillColor: const Color(0xfff4f5f9),
                    contentPadding: const EdgeInsets.symmetric(
                      horizontal: 16,
                      vertical: 12,
                    ),
                    border: OutlineInputBorder(
                      borderRadius: BorderRadius.circular(18),
                      borderSide: BorderSide.none,
                    ),
                  ),
                ),
              ),
              const SizedBox(width: 10),
              InkWell(
                onTap: () => _sendChatMessage(_chatController.text),
                child: Container(
                  padding: const EdgeInsets.all(12),
                  decoration: BoxDecoration(
                    color: const Color(0xffffc107),
                    shape: BoxShape.circle,
                  ),
                  child: const Icon(Icons.send, color: Colors.black),
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
            _buildChatArea(),
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
