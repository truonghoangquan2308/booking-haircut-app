import 'package:flutter/material.dart';

import '../app_session.dart';
import '../barber_post_login.dart';
import '../services/api_service.dart';
import '../services/firebase_auth_service.dart';
import 'otp_screen.dart';

class LoginScreen extends StatefulWidget {
  const LoginScreen({super.key});

  @override
  State<LoginScreen> createState() => _LoginScreenState();
}

class _LoginScreenState extends State<LoginScreen> {
  final _customerPhoneController = TextEditingController();
  final _barberPhoneController = TextEditingController();
  final _authService = FirebaseAuthService();
  bool _isLoading = false;
  bool _navigated = false;

  @override
  void dispose() {
    _customerPhoneController.dispose();
    _barberPhoneController.dispose();
    super.dispose();
  }

  /// Chuyển số 0912... → +84912...
  String _formatPhone(String phone) {
    phone = phone.trim();
    if (phone.startsWith('0')) return '+84${phone.substring(1)}';
    if (!phone.startsWith('+')) return '+84$phone';
    return phone;
  }

  // ===== MAP SỐ TEST FIREBASE → OTP =====
  String? _getTestOtp(String phone) {
    const testNumbers = {'+84901222222': '222222', '+84901234567': '123456'};
    return testNumbers[phone];
  }
  // =======================================

  /// Tab Khách hàng / Thợ phải khớp [role] lưu trong DB (tránh nhầm tài khoản).
  bool _roleMatchesDb(String tabRole, Map<String, dynamic> user) {
    final dbRole = (user['role'] as String?) ?? 'customer';
    if (tabRole == 'barber') return dbRole == 'barber';
    return dbRole == 'customer';
  }

  Future<void> _login(String rawPhone, String role) async {
    if (rawPhone.trim().isEmpty) {
      _showSnack('Vui lòng nhập số điện thoại');
      return;
    }

    final phone = _formatPhone(rawPhone);
    setState(() {
      _isLoading = true;
      _navigated = false;
    });

    try {
      // ===== KIỂM TRA SỐ ĐÃ CÓ TRONG DB CHƯA =====
      try {
        final user = await ApiService.getUser(phone);
        if (user.isNotEmpty && mounted) {
          final map = Map<String, dynamic>.from(user);
          if (!_roleMatchesDb(role, map)) {
            setState(() => _isLoading = false);
            _showSnack(
              role == 'barber'
                  ? 'Số này đã đăng ký là khách hàng. Vui lòng dùng tab Khách hàng.'
                  : 'Số này đã đăng ký là thợ. Vui lòng dùng tab Thợ.',
            );
            return;
          }
          AppSession.setFromUserMap(map);
          setState(() => _isLoading = false);
          Navigator.of(context).pushReplacement(
            MaterialPageRoute(builder: (_) => homeAfterLogin(role)),
          );
          return;
        }
      } catch (_) {
        // 404 = chưa có trong DB → tiếp tục gửi OTP bình thường
      }
      // =============================================

      await _authService.sendOtp(
        phone: phone,
        onCodeSent: (verificationId, resendToken) {
          if (!mounted || _navigated) return;
          _navigated = true;
          setState(() => _isLoading = false);

          // Hiện OTP nếu là số test Firebase
          final otpHint = _getTestOtp(phone);
          if (otpHint != null) _showSnack('Mã OTP: $otpHint');

          Navigator.of(context).push(
            MaterialPageRoute(
              builder: (_) => OtpScreen(
                phone: phone,
                verificationId: verificationId,
                role: role,
                resendToken: resendToken,
              ),
            ),
          );
        },
        onAutoVerified: (user) async {
          if (!mounted || _navigated) return;
          _navigated = true;
          setState(() => _isLoading = false);

          try {
            final data = await ApiService.verifyAndSaveUser(
              phone: phone,
              firebaseUid: user.uid,
              role: role,
            );
            final u = data['user'];
            if (u is Map<String, dynamic>) {
              AppSession.setFromUserMap(u);
            } else if (u is Map) {
              AppSession.setFromUserMap(Map<String, dynamic>.from(u));
            }
          } catch (_) {}

          if (!mounted) return;
          Navigator.of(context).pushReplacement(
            MaterialPageRoute(builder: (_) => homeAfterLogin(role)),
          );
        },
        onError: (error) {
          if (!mounted) return;
          setState(() => _isLoading = false);
          _showSnack('Lỗi: $error');
        },
      );
    } catch (e) {
      if (!mounted) return;
      setState(() => _isLoading = false);
      _showSnack('Lỗi khi gửi OTP: ${e.toString()}');
    }
  }

  void _showSnack(String msg) {
    ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(msg)));
  }

  Widget _buildLoginPane(
    String roleLabel,
    TextEditingController controller,
    String role,
  ) {
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 22, vertical: 24),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Text(
            roleLabel,
            style: const TextStyle(fontSize: 26, fontWeight: FontWeight.w800),
          ),
          const SizedBox(height: 22),
          TextField(
            controller: controller,
            keyboardType: TextInputType.phone,
            decoration: InputDecoration(
              filled: true,
              fillColor: const Color(0xfff5f5f7),
              hintText: 'Số điện thoại (VD: 0912345678)',
              prefixIcon: const Icon(Icons.phone, color: Color(0xffffa000)),
              border: OutlineInputBorder(
                borderRadius: BorderRadius.circular(12),
                borderSide: BorderSide.none,
              ),
            ),
          ),
          const SizedBox(height: 16),
          _isLoading
              ? const Center(
                  child: CircularProgressIndicator(color: Color(0xffffc107)),
                )
              : ElevatedButton(
                  onPressed: () => _login(controller.text, role),
                  style: ElevatedButton.styleFrom(
                    backgroundColor: const Color(0xffffc107),
                    padding: const EdgeInsets.symmetric(vertical: 14),
                    shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(12),
                    ),
                  ),
                  child: const Text(
                    'Đăng nhập',
                    style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold),
                  ),
                ),
        ],
      ),
    );
  }

  Widget _buildHeader() {
    return Container(
      width: double.infinity,
      color: const Color(0xffffc107),
      padding: const EdgeInsets.fromLTRB(22, 12, 22, 0),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              CircleAvatar(
                radius: 22,
                backgroundColor: Colors.white,
                child: Icon(
                  Icons.content_cut,
                  size: 26,
                  color: Colors.orange.shade900,
                ),
              ),
              const SizedBox(width: 12),
              const Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    'GROUP 5',
                    style: TextStyle(fontSize: 20, fontWeight: FontWeight.bold),
                  ),
                  SizedBox(height: 4),
                  Text('Haircut Booking App', style: TextStyle(fontSize: 14)),
                ],
              ),
            ],
          ),
          const SizedBox(height: 12),
          Container(
            decoration: BoxDecoration(
              color: const Color(0xFF003366),
              borderRadius: BorderRadius.circular(30),
              boxShadow: [
                BoxShadow(
                  color: Colors.black.withValues(alpha: 0.15),
                  blurRadius: 8,
                  offset: const Offset(0, 2),
                ),
              ],
            ),
            child: const TabBar(
              indicator: UnderlineTabIndicator(
                borderSide: BorderSide(color: Colors.white, width: 3),
              ),
              indicatorPadding: EdgeInsets.symmetric(horizontal: 4),
              labelColor: Colors.white,
              unselectedLabelColor: Colors.white70,
              labelStyle: TextStyle(fontWeight: FontWeight.w700, fontSize: 18),
              unselectedLabelStyle: TextStyle(
                fontWeight: FontWeight.w600,
                fontSize: 16,
              ),
              tabs: [
                Tab(text: 'Khách hàng'),
                Tab(text: 'Thợ'),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildScrollPane(
    String label,
    TextEditingController controller,
    String role,
  ) {
    return SingleChildScrollView(
      keyboardDismissBehavior: ScrollViewKeyboardDismissBehavior.onDrag,
      child: Column(
        children: [
          const SizedBox(height: 16),
          Container(
            margin: const EdgeInsets.symmetric(horizontal: 16),
            decoration: BoxDecoration(
              color: Colors.white,
              borderRadius: BorderRadius.circular(20),
              boxShadow: const [
                BoxShadow(
                  color: Color.fromRGBO(0, 0, 0, 0.05),
                  blurRadius: 12,
                  offset: Offset(0, 6),
                ),
              ],
            ),
            child: _buildLoginPane(label, controller, role),
          ),
          const SizedBox(height: 24),
        ],
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      resizeToAvoidBottomInset: true,
      backgroundColor: const Color(0xffffc107),
      body: SafeArea(
        child: DefaultTabController(
          length: 2,
          child: Column(
            children: [
              _buildHeader(),
              Expanded(
                child: TabBarView(
                  children: [
                    _buildScrollPane(
                      'Đăng nhập Khách hàng',
                      _customerPhoneController,
                      'customer',
                    ),
                    _buildScrollPane(
                      'Đăng nhập Barber',
                      _barberPhoneController,
                      'barber',
                    ),
                  ],
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
