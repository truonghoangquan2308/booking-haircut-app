import 'dart:async';

import 'package:firebase_auth/firebase_auth.dart';
import 'package:flutter/material.dart';
import 'package:url_launcher/url_launcher.dart';
import 'package:flutter_booking_app/services/api_service.dart';

class BranchChatScreen extends StatefulWidget {
  final Map<String, dynamic> branch;

  const BranchChatScreen({super.key, required this.branch});

  @override
  State<BranchChatScreen> createState() => _BranchChatScreenState();
}

class _BranchChatScreenState extends State<BranchChatScreen> {
  final _chatController = TextEditingController();
  final List<Map<String, dynamic>> _chatMessages = [];
  bool _sending = false;
  bool _loading = true;
  String? _error;
  Timer? _pollTimer;

  String get _branchName =>
      widget.branch['name']?.toString().trim() ?? 'Chi nhánh';
  String get _branchPhone => widget.branch['phone']?.toString().trim() ?? '';
  String get _branchAddress =>
      widget.branch['address']?.toString().trim() ?? 'Chưa có địa chỉ';
  int get _branchId => widget.branch['id'] is int
      ? widget.branch['id'] as int
      : int.tryParse(widget.branch['id']?.toString() ?? '') ?? 0;

  String? get _firebaseUid => FirebaseAuth.instance.currentUser?.uid;

  @override
  void initState() {
    super.initState();
    _loadMessages();
    _pollTimer = Timer.periodic(const Duration(seconds: 4), (_) {
      _loadMessages();
    });
  }

  @override
  void dispose() {
    _pollTimer?.cancel();
    _chatController.dispose();
    super.dispose();
  }

  Future<void> _loadMessages() async {
    if (_branchId <= 0 || _firebaseUid == null) {
      if (mounted) {
        setState(() {
          _loading = false;
          _error = _firebaseUid == null ? 'Vui lòng đăng nhập để chat.' : null;
        });
      }
      return;
    }
    setState(() {
      _loading = true;
      _error = null;
    });

    try {
      final response = await ApiService.getBranchChatMessages(
        branchId: _branchId,
        firebaseUid: _firebaseUid!,
      );
      setState(() {
        _chatMessages.clear();
        _chatMessages.addAll(
          response.map(
            (message) => {
              'sender': message['sender']?.toString() ?? 'customer',
              'text': message['message']?.toString() ?? '',
              'is_read': message['is_read'] == true || message['is_read'] == 1,
            },
          ),
        );
      });
    } catch (e) {
      setState(() {
        _error = e is Exception ? e.toString() : 'Không tải được tin nhắn.';
      });
    } finally {
      if (mounted) {
        setState(() {
          _loading = false;
        });
      }
    }
  }

  Future<void> _launchPhone() async {
    if (_branchPhone.isEmpty) return;
    final uri = Uri(scheme: 'tel', path: _branchPhone);
    if (await canLaunchUrl(uri)) {
      await launchUrl(uri);
    } else {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Không thể gọi điện bằng thiết bị này.')),
      );
    }
  }

  Future<void> _sendChatMessage(String text) async {
    final message = text.trim();
    if (message.isEmpty) return;
    if (_firebaseUid == null) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Vui lòng đăng nhập để chat với lễ tân.')),
      );
      return;
    }

    setState(() {
      _sending = true;
      _error = null;
      _chatController.clear();
    });

    try {
      await ApiService.sendBranchChatMessage(
        branchId: _branchId,
        firebaseUid: _firebaseUid!,
        message: message,
      );
      await _loadMessages();
    } catch (e) {
      setState(() {
        _error = e is Exception ? e.toString() : 'Không gửi được tin nhắn.';
      });
    } finally {
      if (mounted) {
        setState(() {
          _sending = false;
        });
      }
    }
  }

  Widget _buildMessageBubble(Map<String, dynamic> item) {
    final isCustomer = item['sender'] == 'customer';
    final isRead = item['is_read'] == true;
    final statusText = isCustomer
        ? (isRead ? 'Đã đọc bởi lễ tân' : 'Chưa đọc')
        : (isRead ? 'Khách đã xem' : 'Khách chưa xem');

    return Align(
      alignment: isCustomer ? Alignment.centerRight : Alignment.centerLeft,
      child: Container(
        margin: const EdgeInsets.symmetric(vertical: 6),
        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
        constraints: BoxConstraints(
          maxWidth: MediaQuery.of(context).size.width * 0.75,
        ),
        decoration: BoxDecoration(
          color: isCustomer ? const Color(0xff0f172a) : const Color(0xfff4f5f9),
          borderRadius: BorderRadius.circular(18),
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              item['text'] ?? '',
              style: TextStyle(
                color: isCustomer ? Colors.white : Colors.black87,
              ),
            ),
            const SizedBox(height: 6),
            Text(
              statusText,
              style: TextStyle(
                fontSize: 11,
                color: isCustomer ? const Color(0xB3FFFFFF) : Colors.black54,
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildQuickOption(String label) {
    return GestureDetector(
      onTap: () => _sendChatMessage(label),
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
        margin: const EdgeInsets.only(right: 8, bottom: 8),
        decoration: BoxDecoration(
          color: const Color(0x1fffc107),
          borderRadius: BorderRadius.circular(12),
        ),
        child: Text(
          label,
          style: const TextStyle(
            color: Colors.black87,
            fontWeight: FontWeight.w500,
          ),
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        backgroundColor: const Color(0xffffc107),
        foregroundColor: Colors.black,
        title: Text('Chat $_branchName'),
        elevation: 0,
      ),
      backgroundColor: const Color(0xfff4f5f9),
      body: Column(
        children: [
          Container(
            width: double.infinity,
            padding: const EdgeInsets.all(16),
            decoration: const BoxDecoration(
              color: Colors.white,
              borderRadius: BorderRadius.only(
                bottomLeft: Radius.circular(20),
                bottomRight: Radius.circular(20),
              ),
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  _branchName,
                  style: const TextStyle(
                    fontSize: 18,
                    fontWeight: FontWeight.bold,
                  ),
                ),
                const SizedBox(height: 6),
                Text(
                  _branchAddress,
                  style: const TextStyle(color: Colors.black54),
                ),
                const SizedBox(height: 6),
                Row(
                  children: [
                    const Icon(Icons.phone, size: 18, color: Colors.black54),
                    const SizedBox(width: 6),
                    Text(
                      _branchPhone,
                      style: const TextStyle(
                        fontSize: 14,
                        color: Colors.black54,
                      ),
                    ),
                    const Spacer(),
                    ElevatedButton.icon(
                      onPressed: _launchPhone,
                      icon: const Icon(Icons.call, size: 18),
                      label: const Text('Gọi'),
                      style: ElevatedButton.styleFrom(
                        backgroundColor: Colors.black,
                        shape: RoundedRectangleBorder(
                          borderRadius: BorderRadius.circular(12),
                        ),
                      ),
                    ),
                  ],
                ),
              ],
            ),
          ),
          if (_error != null)
            Padding(
              padding: const EdgeInsets.all(16),
              child: Text(
                _error!,
                style: const TextStyle(color: Colors.redAccent),
              ),
            ),
          Expanded(
            child: Padding(
              padding: const EdgeInsets.all(16),
              child: _loading
                  ? const Center(child: CircularProgressIndicator())
                  : _chatMessages.isEmpty
                  ? const Center(child: Text('Chưa có tin nhắn nào.'))
                  : ListView.builder(
                      itemCount: _chatMessages.length,
                      itemBuilder: (context, index) =>
                          _buildMessageBubble(_chatMessages[index]),
                    ),
            ),
          ),
          if (_sending)
            const Padding(
              padding: EdgeInsets.symmetric(horizontal: 16, vertical: 8),
              child: Align(
                alignment: Alignment.centerLeft,
                child: Text(
                  'Đang gửi...',
                  style: TextStyle(color: Colors.black54),
                ),
              ),
            ),
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Wrap(
                  children: [
                    _buildQuickOption('Tôi muốn đặt lịch'),
                    _buildQuickOption('Hủy lịch hẹn'),
                    _buildQuickOption('Giá dịch vụ'),
                    _buildQuickOption('Ưu đãi hiện có'),
                  ],
                ),
                const SizedBox(height: 8),
                Row(
                  children: [
                    Expanded(
                      child: TextField(
                        controller: _chatController,
                        textInputAction: TextInputAction.send,
                        onSubmitted: _sendChatMessage,
                        decoration: InputDecoration(
                          hintText: 'Nhập tin nhắn của bạn...',
                          filled: true,
                          fillColor: Colors.white,
                          contentPadding: const EdgeInsets.symmetric(
                            horizontal: 16,
                            vertical: 12,
                          ),
                          border: OutlineInputBorder(
                            borderRadius: BorderRadius.circular(20),
                            borderSide: BorderSide.none,
                          ),
                        ),
                      ),
                    ),
                    const SizedBox(width: 10),
                    InkWell(
                      onTap: () => _sendChatMessage(_chatController.text),
                      child: Container(
                        padding: const EdgeInsets.all(14),
                        decoration: const BoxDecoration(
                          color: Color(0xffffc107),
                          shape: BoxShape.circle,
                        ),
                        child: const Icon(Icons.send, color: Colors.black),
                      ),
                    ),
                  ],
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}
